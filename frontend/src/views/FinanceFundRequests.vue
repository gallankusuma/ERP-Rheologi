<template>
  <div class="min-h-screen bg-gray-50">
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Fund Requests</h2>
          <p class="text-sm text-gray-500 mt-1">Request cash disbursement for purchase order payment schedules</p>
        </div>
        <button @click="showCreate = true" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">+ New Request</button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-gray-500 uppercase">Total Requested</p>
          <p class="text-2xl font-bold">{{ fmt(totals.total) }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-blue-600 uppercase">Draft</p>
          <p class="text-2xl font-bold text-blue-700">{{ totals.draft }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-yellow-600 uppercase">Pending Approval</p>
          <p class="text-2xl font-bold text-yellow-700">{{ totals.pending }}</p>
        </div>
        <div class="bg-white shadow rounded-lg p-4">
          <p class="text-xs text-green-600 uppercase">Approved</p>
          <p class="text-2xl font-bold text-green-700">{{ totals.approved }}</p>
        </div>
      </div>

      <!-- Filter -->
      <div class="mb-4 flex gap-2">
        <button v-for="s in ['all','draft','submitted','approved','rejected']" :key="s"
          @click="filter = s" :class="filter === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'" class="px-3 py-1.5 rounded-md text-sm border">
          {{ s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1) }}
        </button>
      </div>

      <div v-if="store.loading" class="text-center py-10"><div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>

      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Needed Date</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr v-for="r in filtered" :key="r.id" class="hover:bg-gray-50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ r.request_number }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.po_number || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ r.vendor_name || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ r.purpose }}
                <span v-if="(r.item_count || 0) > 1" class="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">{{ r.item_count }} items</span>
                <span v-if="(r.pending_count || 0) > 0 && (r.approved_count || 0) > 0" class="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{{ r.pending_count }} pending</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ fmtDate(r.needed_date) }}</td>
              <td class="px-4 py-3 text-sm text-right font-mono">{{ fmt(r.amount) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="statusBadge(r.status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ r.status }}</span>
              </td>
              <td class="px-4 py-3 text-right text-sm">
                <div class="inline-flex items-center gap-1.5 flex-wrap justify-end">
                  <button v-if="r.status === 'draft'" @click="openEdit(r)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Edit
                  </button>
                  <button v-if="r.status === 'draft'" @click="submitRequest(r.id)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    Submit
                  </button>
                  <button v-if="r.status === 'draft'" @click="openDeleteConfirm(r)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-100 transition" title="Delete draft request">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Delete
                  </button>
                  <button v-if="(r.status === 'submitted' || r.status === 'partially_approved') && canApprove" @click="openApprove(r)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition" title="Approve all pending items">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                    Approve All
                  </button>
                  <button v-if="(r.status === 'submitted' || r.status === 'partially_approved') && canApprove" @click="openReject(r)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 transition" title="Reject all pending items">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                    Reject All
                  </button>
                  <button @click="openDetail(r)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-gray-100 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Detail
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="8" class="text-center py-8 text-gray-400">No fund requests</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Create/Edit Modal -->
      <div v-if="showCreate || editingRequest" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold mb-4">{{ editingRequest ? 'Edit Fund Request' : 'Create Fund Request' }}</h3>
          <form @submit.prevent="saveFundRequest" class="space-y-3">
            <!-- Header: PO Selection -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <label class="block text-sm font-semibold text-blue-800 mb-1">📦 Link to Purchase Order (optional)</label>
              <select v-model.number="formData.selected_po_id" @change="onHeaderPoSelect" class="w-full px-3 py-2 border rounded-md text-sm">
                <option :value="null">- Tanpa PO (pengeluaran manual) -</option>
                <option v-for="po in approvedPOs" :key="po.id" :value="po.id">{{ po.po_number }} — {{ po.vendor_name || 'No vendor' }} ({{ fmt(po.total_amount) }})</option>
              </select>
              <!-- PO Info Card -->
              <div v-if="selectedPOData" class="mt-2 bg-white rounded-md p-3 border text-sm grid grid-cols-3 gap-2">
                <div><span class="text-gray-500">Vendor:</span> <span class="font-medium">{{ selectedPOData.vendor_name }}</span></div>
                <div><span class="text-gray-500">TOP:</span> <span class="font-semibold text-blue-700">{{ selectedPOData.payment_term || '-' }}</span></div>
                <div><span class="text-gray-500">Total PO:</span> <span class="font-semibold text-green-700">{{ fmt(selectedPOData.total_amount) }}</span></div>
              </div>
              <!-- Split selector for non-Cash -->
              <div v-if="selectedPOData && !isCashTerm" class="mt-2 flex items-center gap-3">
                <span class="text-xs text-gray-600">Pembayaran:</span>
                <label v-for="n in [1,2,3]" :key="n" class="inline-flex items-center gap-1 text-sm cursor-pointer">
                  <input type="radio" :value="n" v-model="paymentSplitCount" @change="generateItemsFromPO" class="accent-blue-600" />
                  <span :class="paymentSplitCount === n ? 'font-semibold text-blue-700' : 'text-gray-600'">{{ n }}x bayar</span>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700">Purpose / Header</label>
                <input v-model="formData.purpose" type="text" required placeholder="e.g. Pembayaran termin proyek X" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Needed Date</label>
                <input v-model="formData.needed_date" type="date" required class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700">Cash on Bank Account</label>
                <input v-model="formData.cash_account" type="text" placeholder="e.g. BCA - 1234567890 - PT XYZ" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Cash / Bank Note</label>
                <input v-model="formData.cash_account_note" type="text" placeholder="e.g. transfer dari rekening operasional" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" />
              </div>
            </div>

            <div class="border-t pt-3">
              <div class="flex justify-between items-center mb-2">
                <h4 class="text-sm font-semibold text-gray-700">Transactions ({{ formData.items.length }})</h4>
                <button type="button" @click="addItem" class="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-xs hover:bg-blue-200">+ Add Transaction</button>
              </div>
              <table class="min-w-full text-sm border">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">PO</th>
                    <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Termin</th>
                    <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Vendor</th>
                    <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Description</th>
                    <th class="px-2 py-1 text-right text-xs font-medium text-gray-500">Amount</th>
                    <th class="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in formData.items" :key="idx" class="border-t">
                    <td class="px-1 py-1">
                      <select v-model.number="it.po_id" @change="onPoSelect(it)" class="w-36 px-2 py-1 border rounded text-sm">
                        <option :value="null">- No PO -</option>
                        <option v-for="po in approvedPOs" :key="po.id" :value="po.id">{{ po.po_number }}</option>
                      </select>
                    </td>
                    <td class="px-1 py-1">
                      <select v-model.number="it.po_schedule_id" @change="onScheduleSelect(it)" class="w-28 px-2 py-1 border rounded text-sm" :disabled="!it.po_id">
                        <option :value="null">- Termin -</option>
                        <option v-for="sch in (poSchedulesCache[it.po_id!] || [])" :key="sch.id" :value="sch.id">Termin {{ sch.schedule_no }}</option>
                      </select>
                    </td>
                    <td class="px-1 py-1 text-xs text-gray-600">{{ getVendorName(it.vendor_id) }}</td>
                    <td class="px-1 py-1"><input v-model="it.description" type="text" placeholder="Detail" class="w-full px-2 py-1 border rounded text-sm" /></td>
                    <td class="px-1 py-1"><input v-model.number="it.amount" type="number" step="0.01" required class="w-32 px-2 py-1 border rounded text-sm text-right" /></td>
                    <td class="px-1 py-1 text-center">
                      <button type="button" @click="removeItem(idx)" :disabled="formData.items.length <= 1" class="text-red-600 hover:underline text-xs disabled:text-gray-300">Remove</button>
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-gray-50">
                  <tr>
                    <td colspan="4" class="px-2 py-1 text-right text-xs font-medium text-gray-600">Total</td>
                    <td class="px-2 py-1 text-right font-mono font-semibold">{{ fmt(itemsTotal) }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Notes (header)</label>
              <textarea v-model="formData.notes" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" rows="2"></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" @click="cancelEdit" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
              <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Approve Modal -->
      <div v-if="approveTarget" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold mb-4">Approve Request</h3>
          <p class="text-sm text-gray-600 mb-2">{{ approveTarget.request_number }} — {{ approveTarget.vendor_name }}</p>
          <p class="text-sm text-gray-500 mb-3">Amount: <span class="font-medium">{{ fmt(approveTarget.amount) }}</span></p>
          <p class="text-sm text-gray-500 mb-4">Purpose: {{ approveTarget.purpose }}</p>
          <div class="flex justify-end gap-3">
            <button @click="approveTarget = null" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
            <button @click="confirmApprove" class="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">Approve</button>
          </div>
        </div>
      </div>

      <!-- Reject Modal -->
      <div v-if="rejectTarget" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold mb-4">Reject Request</h3>
          <p class="text-sm text-gray-600 mb-3">{{ rejectTarget.request_number }} — {{ rejectTarget.vendor_name }}</p>
          <div>
            <label class="block text-sm font-medium text-gray-700">Rejection Reason</label>
            <textarea v-model="rejectReason" class="mt-1 w-full px-3 py-2 border rounded-md text-sm" rows="3" required></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-4">
            <button @click="rejectTarget = null; rejectReason = ''" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
            <button @click="confirmReject" class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Reject</button>
          </div>
        </div>
      </div>

      <!-- Detail Modal -->
      <div v-if="detailTarget" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold mb-4">{{ detailTarget.request_number }}</h3>
          <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div><span class="text-gray-600">Purpose:</span> <span class="font-medium">{{ detailTarget.purpose }}</span></div>
            <div><span class="text-gray-600">Needed Date:</span> <span class="font-medium">{{ fmtDate(detailTarget.needed_date) }}</span></div>
            <div><span class="text-gray-600">Total Amount:</span> <span class="font-medium font-mono">{{ fmt(detailTarget.amount) }}</span></div>
            <div><span class="text-gray-600">Status:</span> <span :class="statusBadge(detailTarget.status)" class="px-2 py-0.5 rounded-full text-xs font-medium inline-block">{{ detailTarget.status }}</span></div>
            <div class="col-span-2"><span class="text-gray-600">Cash on Bank:</span> <span class="font-medium">{{ detailTarget.cash_account || '-' }}</span></div>
            <div v-if="detailTarget.cash_account_note" class="col-span-2"><span class="text-gray-600">Cash Note:</span> <span class="font-medium">{{ detailTarget.cash_account_note }}</span></div>
            <div v-if="detailTarget.notes" class="col-span-2"><span class="text-gray-600">Notes:</span> <span class="font-medium">{{ detailTarget.notes }}</span></div>
            <div v-if="detailTarget.rejection_reason" class="col-span-2"><span class="text-red-600">Rejection Reason:</span> <span class="text-red-700 font-medium">{{ detailTarget.rejection_reason }}</span></div>
          </div>

          <div class="border-t pt-3">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">Transactions</h4>
            <table class="min-w-full text-sm border">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">PO #</th>
                  <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Schedule</th>
                  <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Vendor</th>
                  <th class="px-2 py-1 text-left text-xs font-medium text-gray-500">Description</th>
                  <th class="px-2 py-1 text-right text-xs font-medium text-gray-500">Amount</th>
                  <th class="px-2 py-1 text-center text-xs font-medium text-gray-500">Status</th>
                  <th class="px-2 py-1 text-right text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in (detailTarget.items || [])" :key="it.id" class="border-t align-top">
                  <td class="px-2 py-1">{{ it.po_number || '-' }}</td>
                  <td class="px-2 py-1">{{ it.schedule_label ? `#${it.schedule_no} ${it.schedule_label}` : '-' }}</td>
                  <td class="px-2 py-1">{{ it.vendor_name || '-' }}</td>
                  <td class="px-2 py-1">
                    <div>{{ it.description || '-' }}</div>
                    <div v-if="it.rejection_reason" class="text-xs text-red-600 mt-0.5">Rejected: {{ it.rejection_reason }}</div>
                  </td>
                  <td class="px-2 py-1 text-right font-mono">{{ fmt(it.amount) }}</td>
                  <td class="px-2 py-1 text-center">
                    <span :class="statusBadge(it.status || 'pending')" class="px-2 py-0.5 rounded-full text-xs font-medium inline-block">{{ it.status || 'pending' }}</span>
                  </td>
                  <td class="px-2 py-1 text-right whitespace-nowrap">
                    <template v-if="canApprove && (it.status || 'pending') === 'pending' && (detailTarget.status === 'submitted' || detailTarget.status === 'partially_approved')">
                      <div class="inline-flex items-center gap-1.5 justify-end">
                        <button @click="approveItem(it.id)"
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 transition" title="Approve this item">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                          Approve
                        </button>
                        <button @click="rejectItem(it.id)"
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 transition" title="Reject this item">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                          Reject
                        </button>
                      </div>
                    </template>
                    <span v-else class="text-xs text-gray-300">—</span>
                  </td>
                </tr>
                <tr v-if="!detailTarget.items || !detailTarget.items.length"><td colspan="7" class="px-2 py-3 text-center text-gray-400">No line items</td></tr>
              </tbody>
            </table>
            <p v-if="!canApprove" class="mt-2 text-xs text-gray-500">Approval per transaksi hanya untuk admin (level &ge; 4).</p>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-500">From:</label>
              <select v-model="printDept" class="px-2 py-1.5 border rounded-md text-sm">
                <option value="Manufacturing">Manufacturing</option>
                <option value="HO">HO</option>
              </select>
            </div>
            <button @click="printFundRequest" class="px-4 py-2 bg-slate-700 text-white rounded-md text-sm hover:bg-slate-800 flex items-center gap-2">
              🖨️ Print
            </button>
            <button @click="detailTarget = null" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Close</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="deleteTarget" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
          <h3 class="text-lg font-bold mb-4 text-red-700">Delete Fund Request</h3>
          <p class="text-sm text-gray-600 mb-2">Are you sure you want to delete <span class="font-semibold">{{ deleteTarget.request_number }}</span>?</p>
          <p class="text-sm text-gray-500 mb-4">Amount: <span class="font-medium">{{ fmt(deleteTarget.amount) }}</span></p>
          <p class="text-xs text-red-500 mb-4">This action cannot be undone.</p>
          <div class="flex justify-end gap-3">
            <button @click="deleteTarget = null" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm">Cancel</button>
            <button @click="confirmDelete" class="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700">Delete</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFinanceStore } from '../stores/finance';
import { useAuthStore } from '../stores/auth';
import { useProcurementStore } from '../stores/procurement';
import { api } from '../lib/api';

const store = useFinanceStore();
const auth = useAuthStore();
const procStore = useProcurementStore();
const route = useRoute();
const router = useRouter();
const filter = ref('all');
const showCreate = ref(false);
const editingRequest = ref<any>(null);
const approveTarget = ref<any>(null);
const rejectTarget = ref<any>(null);
const detailTarget = ref<any>(null);
const deleteTarget = ref<any>(null);
const rejectReason = ref('');
const printDept = ref('Manufacturing');

const formData = ref<{
  purpose: string;
  needed_date: string;
  notes: string;
  cash_account: string;
  cash_account_note: string;
  selected_po_id: number | null;
  items: Array<{ po_id: number | null; po_schedule_id: number | null; vendor_id: number | null; description: string; amount: number }>;
}>({
  purpose: '',
  needed_date: '',
  notes: '',
  cash_account: '',
  cash_account_note: '',
  selected_po_id: null,
  items: [{ po_id: null, po_schedule_id: null, vendor_id: null, description: '', amount: 0 }],
});

const paymentSplitCount = ref(1);

// Only show approved POs
const approvedPOs = computed(() =>
  procStore.purchaseOrders.filter((po: any) => (po.approval_status || 0) >= 2)
);

const selectedPOData = computed(() => {
  if (!formData.value.selected_po_id) return null;
  return procStore.purchaseOrders.find((po: any) => po.id === formData.value.selected_po_id) || null;
});

const isCashTerm = computed(() => {
  const term = (selectedPOData.value?.payment_term || '').toLowerCase();
  return term === 'cash' || term === 'cod';
});

const getVendorName = (vendorId: number | null) => {
  if (!vendorId) return '-';
  const po = procStore.purchaseOrders.find((p: any) => p.vendor_id === vendorId);
  return po?.vendor_name || `ID: ${vendorId}`;
};

const generateItemsFromPO = () => {
  const po = selectedPOData.value;
  if (!po) return;
  const total = Number(po.total_amount || 0);
  const splits = paymentSplitCount.value;
  const perSplit = Math.round((total / splits) * 100) / 100;
  const items: any[] = [];
  for (let i = 0; i < splits; i++) {
    const isLast = i === splits - 1;
    const amt = isLast ? Math.round((total - perSplit * (splits - 1)) * 100) / 100 : perSplit;
    items.push({
      po_id: po.id,
      po_schedule_id: null,
      vendor_id: po.vendor_id,
      description: splits === 1
        ? `Pembayaran ${po.po_number} (${po.payment_term || 'Full'})`
        : `Pembayaran ${po.po_number} termin ${i + 1}/${splits}`,
      amount: amt,
    });
  }
  formData.value.items = items;
};

const onHeaderPoSelect = async () => {
  const po = selectedPOData.value;
  if (!po) {
    paymentSplitCount.value = 1;
    formData.value.items = [{ po_id: null, po_schedule_id: null, vendor_id: null, description: '', amount: 0 }];
    return;
  }
  // Auto-fill purpose
  if (!formData.value.purpose) {
    formData.value.purpose = `Pembayaran ${po.po_number} — ${po.vendor_name || ''}`;
  }
  // Cash/COD = always 1x
  if (isCashTerm.value) {
    paymentSplitCount.value = 1;
  }
  // Fetch schedules
  await fetchSchedules(po.id);
  generateItemsFromPO();
};

const poSchedulesCache = ref<Record<number, any[]>>({});

const fetchSchedules = async (poId: number) => {
  if (poSchedulesCache.value[poId]) return;
  try {
    const res = await api.get(`/procurement/purchase-orders/${poId}/payment-schedules`);
    poSchedulesCache.value[poId] = res.data.data;
  } catch (e) {
    console.error('Failed to fetch schedules', e);
  }
};

const onPoSelect = async (item: any) => {
  if (item.po_id) {
    await fetchSchedules(item.po_id);
    const po = procStore.purchaseOrders.find(p => p.id === item.po_id);
    if (po) item.vendor_id = po.vendor_id;
    item.po_schedule_id = null; // Reset schedule when PO changes
  } else {
    item.vendor_id = null;
    item.po_schedule_id = null;
  }
};

const onScheduleSelect = (item: any) => {
  if (item.po_id && item.po_schedule_id && poSchedulesCache.value[item.po_id]) {
    const sch = poSchedulesCache.value[item.po_id].find(s => s.id === item.po_schedule_id);
    if (sch) {
      item.amount = sch.amount;
      item.description = `PO Termin ${sch.schedule_no}: ${sch.label}`;
    }
  }
};

const fmt = (v: number) => v ? Number(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString() : '-';

const canApprove = computed(() => {
  return auth.hasPermission('finance.fund-requests.approve')
    || auth.hasPermission('finance.fund-requests.approve_1')
    || auth.hasPermission('finance.fund-requests.approve_2');
});

const statusBadge = (s: string) => ({
  'bg-blue-100 text-blue-800': s === 'draft',
  'bg-yellow-100 text-yellow-800': s === 'submitted' || s === 'pending',
  'bg-green-100 text-green-800': s === 'approved',
  'bg-red-100 text-red-800': s === 'rejected',
  'bg-purple-100 text-purple-800': s === 'partially_approved',
});

const refreshDetail = async () => {
  if (!detailTarget.value) return;
  const full = await store.getFundRequest(detailTarget.value.id);
  if (full) detailTarget.value = full;
};

const approveItem = async (itemId: number) => {
  if (!detailTarget.value) return;
  try {
    await store.approveFundRequestItem(detailTarget.value.id, itemId);
    await refreshDetail();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to approve item');
  }
};

const rejectItem = async (itemId: number) => {
  if (!detailTarget.value) return;
  const reason = window.prompt('Reason for rejecting this item?');
  if (!reason || !reason.trim()) return;
  try {
    await store.rejectFundRequestItem(detailTarget.value.id, itemId, reason.trim());
    await refreshDetail();
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to reject item');
  }
};

const totals = computed(() => ({
  total: store.fundRequests.reduce((s, r) => s + Number(r.amount || 0), 0),
  draft: store.fundRequests.filter(r => r.status === 'draft').length,
  pending: store.fundRequests.filter(r => r.status === 'submitted').length,
  approved: store.fundRequests.filter(r => r.status === 'approved').length,
}));

const filtered = computed(() => {
  if (filter.value === 'all') return store.fundRequests;
  return store.fundRequests.filter(r => r.status === filter.value);
});

const resetForm = () => {
  formData.value = {
    purpose: '',
    needed_date: '',
    notes: '',
    cash_account: '',
    cash_account_note: '',
    selected_po_id: null,
    items: [{ po_id: null, po_schedule_id: null, vendor_id: null, description: '', amount: 0 }],
  };
  paymentSplitCount.value = 1;
};

const addItem = () => {
  formData.value.items.push({ po_id: null, po_schedule_id: null, vendor_id: null, description: '', amount: 0 });
};

const removeItem = (idx: number) => {
  if (formData.value.items.length > 1) formData.value.items.splice(idx, 1);
};

const itemsTotal = computed(() =>
  formData.value.items.reduce((s, it) => s + Number(it.amount || 0), 0)
);

const openEdit = async (r: any) => {
  editingRequest.value = r;
  
  // pre-fetch schedules for existing POs
  if (r.items && r.items.length) {
    for (const it of r.items) {
      if (it.po_id) await fetchSchedules(it.po_id);
    }
  } else if (r.po_id) {
    await fetchSchedules(r.po_id);
  }

  formData.value = {
    purpose: r.purpose,
    needed_date: r.needed_date ? String(r.needed_date).slice(0, 10) : '',
    notes: r.notes || '',
    cash_account: r.cash_account || '',
    cash_account_note: r.cash_account_note || '',
    selected_po_id: r.po_id || null,
    items: (r.items && r.items.length)
      ? r.items.map((it: any) => ({
          po_id: it.po_id ?? null,
          po_schedule_id: it.po_schedule_id ?? null,
          vendor_id: it.vendor_id ?? null,
          description: it.description || '',
          amount: Number(it.amount || 0),
        }))
      : [{ po_id: r.po_id ?? null, po_schedule_id: r.po_schedule_id ?? null, vendor_id: r.vendor_id ?? null, description: r.purpose || '', amount: Number(r.amount || 0) }],
  };
};

const cancelEdit = () => {
  editingRequest.value = null;
  showCreate.value = false;
  resetForm();
};

const saveFundRequest = async () => {
  try {
    if (!formData.value.items.length) return;
    
    const scheduleIds = formData.value.items.map(it => it.po_schedule_id).filter(id => id);
    if (scheduleIds.length !== new Set(scheduleIds).size) {
      alert('Terdapat duplikasi Termin PO yang sama di dalam satu pengajuan. Silakan hapus baris yang dobel.');
      return;
    }

    const payload = {
      purpose: formData.value.purpose,
      needed_date: formData.value.needed_date,
      notes: formData.value.notes || null,
      cash_account: formData.value.cash_account || null,
      cash_account_note: formData.value.cash_account_note || null,
      items: formData.value.items.map(it => ({
        po_id: it.po_id || null,
        po_schedule_id: it.po_schedule_id || null,
        vendor_id: it.vendor_id || null,
        description: it.description || null,
        amount: Number(it.amount || 0),
      })),
    };
    if (editingRequest.value) {
      await api.put(`/finance/fund-requests/${editingRequest.value.id}`, payload);
      editingRequest.value = null;
      await store.fetchFundRequests();
    } else {
      await store.createFundRequest(payload);
      showCreate.value = false;
    }
    resetForm();
  } catch (error) {
    console.error('Error saving fund request:', error);
  }
};

const submitRequest = async (id: number) => {
  try {
    await store.submitFundRequest(id);
  } catch (error) {
    console.error('Error submitting request:', error);
  }
};

const openApprove = (r: any) => {
  approveTarget.value = r;
};

const confirmApprove = async () => {
  if (approveTarget.value) {
    try {
      await store.approveFundRequest(approveTarget.value.id);
      approveTarget.value = null;
    } catch (error) {
      console.error('Error approving request:', error);
    }
  }
};

const openReject = (r: any) => {
  rejectTarget.value = r;
  rejectReason.value = '';
};

const confirmReject = async () => {
  if (rejectTarget.value && rejectReason.value) {
    try {
      await store.rejectFundRequest(rejectTarget.value.id, rejectReason.value);
      rejectTarget.value = null;
      rejectReason.value = '';
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  }
};

const openDetail = async (r: any) => {
  detailTarget.value = r;
  try {
    const full = await store.getFundRequest(r.id);
    if (full) detailTarget.value = full;
  } catch (e) {
    console.error('Failed to load fund request detail', e);
  }
};

const openDeleteConfirm = (r: any) => {
  deleteTarget.value = r;
};

const confirmDelete = async () => {
  if (!deleteTarget.value) return;
  try {
    await store.deleteFundRequest(deleteTarget.value.id);
    deleteTarget.value = null;
  } catch (e: any) {
    alert(e?.response?.data?.error || 'Failed to delete fund request');
  }
};

function printFundRequest() {
  if (!detailTarget.value) return;
  const d = detailTarget.value;
  const items = d.items || [];
  const reqDate = d.needed_date ? new Date(d.needed_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
  const reqNumber = d.request_number || '-';
  const totalAmount = items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0);

  const itemRows = items.map((it: any, idx: number) => {
    const poNum = it.po_number || '-';
    const desc = it.description || it.purpose || '-';
    const vendorName = it.vendor_name || '-';
    const bankInfo = d.cash_account || '';
    return `
      <tr>
        <td style="text-align:center;vertical-align:top;border:1px solid #000;padding:6px 4px;font-size:12px">${idx + 1}</td>
        <td style="vertical-align:top;border:1px solid #000;padding:6px 8px;font-size:11px">
          <div style="font-size:12px">${poNum}</div>
          <div>${desc}</div>
          <div>${vendorName}</div>
          ${bankInfo ? '<div style="background:#ffeb3b;padding:2px 4px;margin-top:3px;font-size:10px">Trf ke Rek ' + bankInfo + '</div>' : ''}
        </td>
        <td style="vertical-align:top;border:1px solid #000;padding:6px 8px;font-size:11px"></td>
        <td style="text-align:right;vertical-align:top;border:1px solid #000;padding:6px 8px;font-size:12px;white-space:nowrap">${Number(it.amount || 0).toLocaleString('id-ID')}</td>
        <td style="vertical-align:top;border:1px solid #000;padding:6px 8px;font-size:11px"></td>
      </tr>`;
  }).join('');

  const printContent = `
    <html>
      <head>
        <title>Funding Request - ${reqNumber}</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 30px; font-size: 12px; color: #000; }
          * { box-sizing: border-box; }
          .page { border: 2px solid #000; padding: 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 25px 15px; }
          .title { font-size: 16px; font-weight: bold; text-align: center; flex: 1; letter-spacing: 2px; padding-top: 10px; }
          .logo { text-align: right; }
          .logo-text { font-size: 22px; font-weight: 900; color: #64748b; letter-spacing: -1px; }
          .logo-text span { color: #3b82f6; }
          .logo-sub { font-size: 10px; font-weight: bold; color: #3b82f6; }
          .meta { display: flex; justify-content: space-between; padding: 5px 25px 15px; font-size: 12px; }
          .meta-left { line-height: 1.8; }
          .meta-left .label { display: inline-block; width: 50px; }
          .meta-right { text-align: right; font-weight: bold; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; }
          th { border: 1px solid #000; padding: 8px; font-size: 12px; font-weight: bold; text-align: center; background: #f5f5f5; }
          .total-row td { border: 1px solid #000; padding: 8px; font-weight: bold; font-size: 13px; }
          .signatures { display: flex; justify-content: space-between; padding: 20px 25px 5px; }
          .sig-box { width: 45%; }
          .sig-title { font-size: 12px; margin-bottom: 60px; }
          .sig-line { border-bottom: 1px solid #000; margin-bottom: 5px; width: 200px; }
          .sig-date { font-size: 11px; font-weight: bold; }
          @media print {
            body { margin: 15px; }
            .page { border: 2px solid #000; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div style="width:60px"></div>
            <div class="title">FUNDING REQUEST FORM</div>
            <div class="logo">
              <img src="/logo-rheologi-v2.png" alt="Rheologi" style="height:64px"/>
            </div>
          </div>

          <div class="meta">
            <div class="meta-left">
              <div><span class="label">Date</span>: ${reqDate}</div>
              <div><span class="label">To</span>: DIREKTUR</div>
              <div><span class="label">From</span>: ${printDept.value}</div>
            </div>
            <div class="meta-right">
              NO. ${reqNumber}
            </div>
          </div>

          <div style="padding: 0 25px;">
            <table>
              <thead>
                <tr>
                  <th style="width:5%">No</th>
                  <th style="width:50%">Description</th>
                  <th style="width:15%">Allocation</th>
                  <th style="width:18%">Amount</th>
                  <th style="width:12%">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="3" style="text-align:center;border:1px solid #000">TOTAL</td>
                  <td style="text-align:right;border:1px solid #000;white-space:nowrap">Rp ${totalAmount.toLocaleString('id-ID')}</td>
                  <td style="border:1px solid #000"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-title">Dibuat oleh,</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('FR:'+reqNumber+'|Dibuat:'+printDept.value+'|Tgl:'+reqDate)}" width="80" height="80"/>
              <div style="margin-top:4px"><strong>(${d.requester_name || '...........................'})</strong></div>
              <div class="sig-date">Date : ${reqDate}</div>
            </div>
            <div class="sig-box">
              <div class="sig-title">Di setujui oleh,</div>
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('FR:'+reqNumber+'|Approve|Tgl:')}" width="80" height="80"/>
              <div style="margin-top:4px"><strong>(................................)</strong></div>
              <div class="sig-date">Date :</div>
            </div>
          </div>

          <div style="height: 15px"></div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 300);
  }
}

onMounted(async () => {
  await store.fetchFundRequests();
  await procStore.fetchPurchaseOrders();
  const openId = Number(route.query.openId);
  if (openId && Number.isFinite(openId)) {
    const target = store.fundRequests.find(r => r.id === openId);
    if (target) {
      await openDetail(target);
    } else {
      const full = await store.getFundRequest(openId);
      if (full) detailTarget.value = full;
    }
    router.replace({ query: {} });
  }
});
</script>
