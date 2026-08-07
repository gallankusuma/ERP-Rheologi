import { Router, Request, Response } from 'express';
import { dbAll, dbGet } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// GET /crm/dashboard — Unified CRM dashboard stats
router.get('/dashboard', authMiddleware, requirePermission('crm.dashboard', 'view'), async (req: Request, res: Response) => {
  try {
    // helper: convert [{currency, total}] rows into { IDR: 123, USD: 456 }
    const toCurrencyMap = (rows: any[]) => {
      const map: Record<string, number> = {};
      for (const r of rows) map[r.currency || 'IDR'] = Number(r.total) || 0;
      return map;
    };

    // prospect counts (currency-independent)
    const prospectStats = await dbGet(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN temperature = 'hot' AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as hot,
        SUM(CASE WHEN temperature = 'warm' AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as warm,
        SUM(CASE WHEN temperature = 'cold' AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as cold,
        SUM(CASE WHEN next_follow_up <= CURDATE() AND status NOT IN ('converted','disqualified') THEN 1 ELSE 0 END) as overdue_followups
      FROM prospects
      WHERE is_archived = 0
    `);

    // prospect pipeline value grouped by currency
    const prospectPipelineRows = await dbAll(`
      SELECT currency, COALESCE(SUM(estimated_value), 0) as total
      FROM prospects
      WHERE status NOT IN ('converted','disqualified') AND is_archived = 0
      GROUP BY currency
    `) as any[];

    // lead counts (currency-independent)
    const leadStats = await dbGet(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN stage NOT IN ('Won','Lost') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN stage = 'Lost' THEN 1 ELSE 0 END) as lost
      FROM leads
      WHERE is_archived = 0
    `);

    // lead values grouped by currency
    const leadPipelineRows = await dbAll(`
      SELECT currency, COALESCE(SUM(CASE WHEN stage NOT IN ('Won','Lost') THEN value ELSE 0 END), 0) as total
      FROM leads WHERE is_archived = 0 GROUP BY currency
    `) as any[];
    const leadWonRows = await dbAll(`
      SELECT currency, COALESCE(SUM(value), 0) as total
      FROM leads WHERE stage = 'Won' AND is_archived = 0 GROUP BY currency
    `) as any[];
    const leadTotalRows = await dbAll(`
      SELECT currency, COALESCE(SUM(value), 0) as total
      FROM leads WHERE is_archived = 0 GROUP BY currency
    `) as any[];

    const clientStats = await dbGet(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE client_id IS NOT NULL AND status NOT IN ('cancelled','draft')), 0) as total_revenue,
        COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE client_id IS NOT NULL AND status IN ('confirmed','processing','open')), 0) as total_outstanding
      FROM clients
    `);

    // lead stage breakdown with currency-grouped values
    const leadsByStageRaw = await dbAll(`
      SELECT stage, currency, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value
      FROM leads WHERE is_archived = 0 GROUP BY stage, currency
      ORDER BY FIELD(stage, 'New', 'Qualified', 'Discussion', 'Proposal', 'Negotiation', 'Won', 'Lost')
    `) as any[];

    // collapse into per-stage objects with currency maps
    const stageMap: Record<string, { stage: string; count: number; total_value_by_currency: Record<string, number> }> = {};
    for (const r of leadsByStageRaw) {
      if (!stageMap[r.stage]) stageMap[r.stage] = { stage: r.stage, count: 0, total_value_by_currency: {} };
      stageMap[r.stage].count += Number(r.count);
      stageMap[r.stage].total_value_by_currency[r.currency || 'IDR'] = Number(r.total_value) || 0;
    }
    const leadsByStage = Object.values(stageMap);

    // prospect temperature breakdown
    const prospectsByTemp = await dbAll(`
      SELECT temperature, COUNT(*) as count
      FROM prospects
      WHERE status NOT IN ('converted', 'disqualified') AND is_archived = 0
      GROUP BY temperature
    `);

    // recent activities
    const recentLeads = await dbAll(`
      SELECT id, company, contact_name, stage, value, currency, updated_at, 'lead' as type
      FROM leads WHERE is_archived = 0 ORDER BY updated_at DESC LIMIT 5
    `);
    const recentProspects = await dbAll(`
      SELECT id, company_name as company, contact_name, status as stage, estimated_value as value, currency, updated_at, 'prospect' as type
      FROM prospects WHERE is_archived = 0 ORDER BY updated_at DESC LIMIT 5
    `);
    const recentActivity = [...recentLeads, ...recentProspects]
      .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);

    // overdue follow-ups
    const overdueFollowups = await dbAll(`
      SELECT id, code, company_name, contact_name, next_follow_up, temperature, estimated_value, currency
      FROM prospects
      WHERE next_follow_up <= CURDATE() AND status NOT IN ('converted', 'disqualified') AND is_archived = 0
      ORDER BY next_follow_up ASC
      LIMIT 10
    `);

    // conversion rates
    const totalProspects = prospectStats?.total || 0;
    const convertedProspects = prospectStats?.converted || 0;
    const totalLeads = leadStats?.total || 0;
    const wonLeads = leadStats?.won || 0;
    const conversionRates = {
      prospectToLead: totalProspects > 0 ? Math.round((convertedProspects / totalProspects) * 100) : 0,
      leadToWon: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0,
      overall: totalProspects > 0 ? Math.round((wonLeads / totalProspects) * 100) : 0,
    };

    // monthly trend with currency-grouped won values
    const monthlyTrendRaw = await dbAll(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        currency,
        COUNT(*) as leads_created,
        SUM(CASE WHEN stage = 'Won' THEN 1 ELSE 0 END) as leads_won,
        COALESCE(SUM(CASE WHEN stage = 'Won' THEN value ELSE 0 END), 0) as won_estimated_value
      FROM leads
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND is_archived = 0
      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), currency
      ORDER BY month ASC
    `) as any[];

    const trendMap: Record<string, any> = {};
    for (const r of monthlyTrendRaw) {
      if (!trendMap[r.month]) trendMap[r.month] = { month: r.month, leads_created: 0, leads_won: 0, won_value_by_currency: {} };
      trendMap[r.month].leads_created += Number(r.leads_created);
      trendMap[r.month].leads_won += Number(r.leads_won);
      const cur = r.currency || 'IDR';
      trendMap[r.month].won_value_by_currency[cur] = (trendMap[r.month].won_value_by_currency[cur] || 0) + Number(r.won_estimated_value);
    }
    const monthlyTrend = Object.values(trendMap);

    // pipeline integration stats
    const pipelineStats = await dbGet(`
      SELECT
        (SELECT COUNT(*) FROM leads WHERE stage = 'Won') as leads_converted,
        (SELECT COUNT(*) FROM sales_orders WHERE client_id IS NOT NULL OR lead_id IS NOT NULL) as crm_linked_orders,
        (SELECT COUNT(*) FROM sales_orders WHERE project_id IS NOT NULL) as orders_with_projects,
        (SELECT COUNT(*) FROM client_projects WHERE so_id IS NOT NULL) as projects_from_so,
        (SELECT COUNT(*) FROM work_orders WHERE so_id IS NOT NULL) as work_orders_from_so,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE client_id IS NOT NULL AND status NOT IN ('cancelled')) as crm_revenue_pipeline,
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'draft' AND client_id IS NOT NULL) as draft_orders,
        (SELECT COUNT(*) FROM sales_orders WHERE status IN ('confirmed', 'processing', 'open') AND client_id IS NOT NULL) as active_orders
    `);

    // recent CRM-linked sales orders
    const recentCrmOrders = await dbAll(`
      SELECT so.id, so.so_number, so.status, so.total_amount, so.created_at,
             COALESCE(cl.name, c.name) as customer_name,
             l.company as lead_company,
             cp.project_number
      FROM sales_orders so
      LEFT JOIN clients cl ON so.client_id = cl.id
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN leads l ON so.lead_id = l.id
      LEFT JOIN client_projects cp ON so.project_id = cp.id
      WHERE so.client_id IS NOT NULL OR so.lead_id IS NOT NULL
      ORDER BY so.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        prospects: {
          ...(prospectStats || {}),
          pipeline_value_by_currency: toCurrencyMap(prospectPipelineRows),
        },
        leads: {
          ...(leadStats || {}),
          pipeline_value_by_currency: toCurrencyMap(leadPipelineRows),
          won_value_by_currency: toCurrencyMap(leadWonRows),
          total_value_by_currency: toCurrencyMap(leadTotalRows),
        },
        clients: clientStats || {},
        leadsByStage,
        prospectsByTemp,
        recentActivity,
        overdueFollowups,
        conversionRates,
        monthlyTrend,
        pipeline: pipelineStats || {},
        recentCrmOrders,
      }
    });
  } catch (error: any) {
    console.error('CRM Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch CRM dashboard' });
  }
});

// GET /crm/tasks — Unified CRM task monitoring across all modules
router.get('/tasks', authMiddleware, requirePermission('crm.tasks', 'view'), async (req: Request, res: Response) => {
  try {
    const { status, source, priority, search } = req.query;

    // 1. Project Tasks
    let ptWhere = '';
    const ptParams: any[] = [];

    if (status === 'open') {
      ptWhere += ` AND pt.status IN ('To Do', 'In Progress')`;
    } else if (status === 'overdue') {
      ptWhere += ` AND pt.due_date < CURDATE() AND pt.status IN ('To Do', 'In Progress')`;
    } else if (status === 'done') {
      ptWhere += ` AND pt.status = 'Done'`;
    }

    if (priority) {
      ptWhere += ` AND pt.priority = ?`;
      ptParams.push(priority);
    }

    if (search) {
      ptWhere += ` AND (pt.title LIKE ? OR cp.project_name LIKE ? OR c.name LIKE ?)`;
      const s = `%${search}%`;
      ptParams.push(s, s, s);
    }

    const projectTasks = (!source || source === 'all' || source === 'project_task') ? await dbAll(`
      SELECT pt.id, pt.title, pt.description, pt.status, pt.priority,
        pt.start_date, pt.due_date, pt.created_at, pt.updated_at,
        'project_task' as source,
        cp.id as ref_id, cp.project_name as ref_name, cp.project_number as ref_code,
        c.name as client_name, c.id as client_id, u.full_name as assigned_name
      FROM project_tasks pt
      JOIN client_projects cp ON pt.project_id = cp.id
      LEFT JOIN clients c ON cp.client_id = c.id
      LEFT JOIN users u ON pt.assigned_to = u.id
      WHERE 1=1 ${ptWhere}
    `, ptParams) : [];

    // 2. Prospect Follow-ups
    let prWhere = '';
    const prParams: any[] = [];

    if (status === 'overdue') {
      prWhere += ` AND p.next_follow_up < CURDATE()`;
    } else if (status === 'done') {
      prWhere += ` AND 1=0`;
    }

    if (search) {
      prWhere += ` AND (p.company_name LIKE ? OR p.contact_name LIKE ?)`;
      const s = `%${search}%`;
      prParams.push(s, s);
    }

    const prospectTasks = (!source || source === 'all' || source === 'prospect') ? await dbAll(`
      SELECT p.id,
        CONCAT('Follow up: ', p.company_name) as title,
        CONCAT('Contact ', COALESCE(p.contact_name,''), ' - ', COALESCE(p.notes, '')) as description,
        CASE WHEN p.next_follow_up < CURDATE() THEN 'Overdue'
             WHEN p.next_follow_up = CURDATE() THEN 'In Progress'
             ELSE 'To Do' END as status,
        CASE p.temperature WHEN 'hot' THEN 'High' WHEN 'warm' THEN 'Medium' ELSE 'Low' END as priority,
        NULL as start_date, p.next_follow_up as due_date,
        p.created_at, p.updated_at,
        'prospect' as source, p.id as ref_id,
        p.company_name as ref_name, p.code as ref_code,
        NULL as client_name, NULL as client_id, u.full_name as assigned_name
      FROM prospects p
      LEFT JOIN users u ON p.assigned_to = u.id
      WHERE p.next_follow_up IS NOT NULL AND p.status NOT IN ('converted', 'disqualified') AND p.is_archived = 0 ${prWhere}
    `, prParams) : [];

    // 3. Lead actions
    let ldWhere = '';
    const ldParams: any[] = [];

    if (status === 'overdue') {
      ldWhere += ` AND l.due_date IS NOT NULL AND l.due_date < CURDATE()`;
    } else if (status === 'done') {
      ldWhere += ` AND 1=0`;
    }

    if (search) {
      ldWhere += ` AND (l.company LIKE ? OR l.contact_name LIKE ?)`;
      const s = `%${search}%`;
      ldParams.push(s, s);
    }

    const leadTasks = (!source || source === 'all' || source === 'lead') ? await dbAll(`
      SELECT l.id,
        CONCAT(l.stage, ': ', l.company) as title,
        CONCAT('Contact ', COALESCE(l.contact_name,''), ' - Value: ', FORMAT(COALESCE(l.value,0), 0)) as description,
        CASE WHEN l.due_date IS NOT NULL AND l.due_date < CURDATE() THEN 'Overdue' ELSE 'To Do' END as status,
        CASE WHEN COALESCE(l.value,0) >= 100000000 THEN 'High' WHEN COALESCE(l.value,0) >= 50000000 THEN 'Medium' ELSE 'Low' END as priority,
        NULL as start_date, l.due_date,
        l.created_at, l.updated_at,
        'lead' as source, l.id as ref_id,
        l.company as ref_name, CONCAT('LEAD-', l.id) as ref_code,
        NULL as client_name, NULL as client_id, u.full_name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.stage NOT IN ('Won', 'Lost') AND l.is_archived = 0 ${ldWhere}
    `, ldParams) : [];

    // Combine & sort by due_date
    const allTasks = [...projectTasks, ...prospectTasks, ...leadTasks];
    allTasks.sort((a: any, b: any) => {
      const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return aDate - bDate;
    });

    // Summary
    const now = new Date().toISOString().split('T')[0];
    const summary = {
      total: allTasks.length,
      todo: allTasks.filter((t: any) => t.status === 'To Do').length,
      in_progress: allTasks.filter((t: any) => t.status === 'In Progress').length,
      overdue: allTasks.filter((t: any) => t.status !== 'Done' && t.due_date && t.due_date < now).length,
      done: allTasks.filter((t: any) => t.status === 'Done').length,
      by_source: {
        project_task: allTasks.filter((t: any) => t.source === 'project_task').length,
        prospect: allTasks.filter((t: any) => t.source === 'prospect').length,
        lead: allTasks.filter((t: any) => t.source === 'lead').length,
      }
    };

    res.json({ success: true, data: allTasks, summary });
  } catch (error: any) {
    console.error('CRM Tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch CRM tasks' });
  }
});

export default router;
