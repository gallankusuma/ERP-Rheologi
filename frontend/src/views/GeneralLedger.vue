<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">General Ledger</h1>
          <p class="text-gray-500 mt-1">Chart of Accounts, Journals & Financial Reports</p>
        </div>
        <div class="flex gap-3">
          <button @click="activeTab = 'dashboard'" :class="tabClass('dashboard')" class="px-4 py-2 rounded-lg font-medium text-sm transition-all">
            📊 Dashboard
          </button>
          <button @click="activeTab = 'coa'" :class="tabClass('coa')" class="px-4 py-2 rounded-lg font-medium text-sm transition-all">
            📋 Chart of Accounts
          </button>
          <button @click="activeTab = 'journals'" :class="tabClass('journals')" class="px-4 py-2 rounded-lg font-medium text-sm transition-all">
            📝 Journal Entries
          </button>
          <button @click="activeTab = 'reports'" :class="tabClass('reports')" class="px-4 py-2 rounded-lg font-medium text-sm transition-all">
            📈 Reports
          </button>
        </div>
      </div>

      <!-- Dashboard Tab -->
      <div v-if="activeTab === 'dashboard'">
        <!-- Stats Cards -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase">Accounts</p>
            <p class="text-2xl font-bold text-gray-900 mt-1">{{ dashboard.summary?.total_accounts || 0 }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase">Posted Entries</p>
            <p class="text-2xl font-bold text-green-600 mt-1">{{ dashboard.summary?.posted_entries || 0 }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase">Draft Entries</p>
            <p class="text-2xl font-bold text-yellow-600 mt-1">{{ dashboard.summary?.draft_entries || 0 }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase">Total Debits</p>
            <p class="text-lg font-bold text-blue-600 mt-1">{{ formatCurrency(dashboard.summary?.total_debits) }}</p>
          </div>
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p class="text-xs font-semibold text-gray-500 uppercase">Total Credits</p>
            <p class="text-lg font-bold text-indigo-600 mt-1">{{ formatCurrency(dashboard.summary?.total_credits) }}</p>
          </div>
        </div>

        <!-- Current Period + Type Summary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 class="font-bold text-gray-900 mb-3">📅 Current Fiscal Period</h3>
            <div v-if="dashboard.currentPeriod" class="space-y-2">
              <p class="text-lg font-semibold text-blue-600">{{ dashboard.currentPeriod.period_name }}</p>
              <p class="text-sm text-gray-500">{{ dashboard.currentPeriod.start_date }} — {{ dashboard.currentPeriod.end_date }}</p>
              <span class="px-3 py-1 rounded-full text-xs font-semibold"
                :class="dashboard.currentPeriod.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                {{ dashboard.currentPeriod.status }}
              </span>
            </div>
            <p v-else class="text-gray-400">No active period</p>
          </div>

          <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 class="font-bold text-gray-900 mb-3">💰 Account Balances by Type</h3>
            <div class="space-y-2">
              <div v-for="t in dashboard.typeSummary" :key="t.account_type" class="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                <span class="text-sm font-medium capitalize" :class="typeColor(t.account_type)">{{ typeLabel(t.account_type) }}</span>
                <div class="text-right">
                  <span class="text-sm font-semibold text-gray-900">{{ formatCurrency(t.total_balance) }}</span>
                  <span class="text-xs text-gray-400 ml-2">({{ t.count }} akun)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Entries -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 class="font-bold text-gray-900 mb-3">🕐 Recent Journal Entries</h3>
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-semibold text-gray-700">Entry #</th>
                <th class="px-4 py-2 text-left text-xs font-semibold text-gray-700">Date</th>
                <th class="px-4 py-2 text-left text-xs font-semibold text-gray-700">Description</th>
                <th class="px-4 py-2 text-left text-xs font-semibold text-gray-700">Reference</th>
                <th class="px-4 py-2 text-right text-xs font-semibold text-gray-700">Debit</th>
                <th class="px-4 py-2 text-right text-xs font-semibold text-gray-700">Credit</th>
                <th class="px-4 py-2 text-center text-xs font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="e in dashboard.recentEntries" :key="e.id" class="hover:bg-blue-50/40 cursor-pointer" @click="viewJournalEntry(e)">
                <td class="px-4 py-2 text-sm font-mono text-blue-600">{{ e.entry_number }}</td>
                <td class="px-4 py-2 text-sm text-gray-600">{{ formatDate(e.entry_date) }}</td>
                <td class="px-4 py-2 text-sm text-gray-800">{{ e.description }}</td>
                <td class="px-4 py-2 text-sm text-gray-500">{{ e.reference_type || '—' }}</td>
                <td class="px-4 py-2 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(e.total_debit) }}</td>
                <td class="px-4 py-2 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(e.total_credit) }}</td>
                <td class="px-4 py-2 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-semibold" :class="statusColor(e.status)">{{ e.status }}</span>
                </td>
              </tr>
              <tr v-if="!dashboard.recentEntries?.length">
                <td colspan="7" class="px-4 py-8 text-center text-gray-400">No journal entries yet</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- COA Tab -->
      <div v-if="activeTab === 'coa'">
        <div class="flex justify-between items-center mb-4">
          <div class="flex gap-3">
            <select v-model="coaFilter" @change="fetchCOA" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Types</option>
              <option value="asset">Aset</option>
              <option value="liability">Liabilitas</option>
              <option value="equity">Ekuitas</option>
              <option value="revenue">Pendapatan</option>
              <option value="cogs">COGS</option>
              <option value="expense">Beban</option>
              <option value="other_income">Lain-lain</option>
              <option value="tax">Pajak</option>
            </select>
            <input v-model="coaSearch" type="text" placeholder="Search accounts..." class="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[250px]" />
          </div>
          <button @click="openCoaModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm">
            <span>+</span> Add Account
          </button>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Code</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Account Name</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700">Normal</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-700">Current Balance</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="a in filteredCOA" :key="a.id" class="hover:bg-blue-50/40" :class="{ 'bg-gray-50 font-semibold': a.is_header }">
                <td class="px-4 py-2.5 text-sm font-mono" :class="a.is_header ? 'text-gray-900 font-bold' : 'text-gray-600'" :style="{ paddingLeft: (a.level * 16 + 16) + 'px' }">
                  {{ a.account_code }}
                </td>
                <td class="px-4 py-2.5 text-sm" :class="a.is_header ? 'font-bold text-gray-900' : 'text-gray-800'">
                  {{ a.account_name }}
                </td>
                <td class="px-4 py-2.5">
                  <span class="px-2 py-0.5 rounded text-xs font-medium" :class="typeBadge(a.account_type)">{{ typeLabel(a.account_type) }}</span>
                </td>
                <td class="px-4 py-2.5 text-center text-xs font-medium" :class="a.normal_balance === 'debit' ? 'text-blue-600' : 'text-green-600'">
                  {{ a.normal_balance }}
                </td>
                <td class="px-4 py-2.5 text-sm font-medium text-right" :class="Number(a.current_balance) < 0 ? 'text-red-600' : 'text-gray-900'">
                  {{ a.is_header ? '' : formatCurrency(a.current_balance) }}
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span class="w-2.5 h-2.5 rounded-full inline-block" :class="a.is_active ? 'bg-green-500' : 'bg-gray-300'"></span>
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-1">
                    <button @click="openCoaModal(a)" class="text-blue-600 hover:text-blue-800 text-sm" title="Edit">✏️</button>
                    <button v-if="!a.is_header" @click="deleteCOA(a)" class="text-red-400 hover:text-red-600 text-sm" title="Delete">🗑</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Journal Entries Tab -->
      <div v-if="activeTab === 'journals'">
        <div class="flex justify-between items-center mb-4">
          <div class="flex gap-3">
            <select v-model="jeFilter.status" @change="fetchJournalEntries" class="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="posted">Posted</option>
              <option value="reversed">Reversed</option>
            </select>
            <input v-model="jeFilter.from_date" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="fetchJournalEntries" />
            <input v-model="jeFilter.to_date" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" @change="fetchJournalEntries" />
          </div>
          <button @click="openJournalModal()" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 text-sm">
            <span>+</span> New Journal Entry
          </button>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Entry #</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Description</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Reference</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700">Lines</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-700">Debit</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-gray-700">Credit</th>
                <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700">Status</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="e in journalEntries" :key="e.id" class="hover:bg-blue-50/40">
                <td class="px-4 py-2.5 text-sm font-mono text-blue-600 cursor-pointer" @click="viewJournalEntry(e)">{{ e.entry_number }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-600">{{ formatDate(e.entry_date) }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-800">{{ e.description }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-500">{{ e.reference_type || '—' }}</td>
                <td class="px-4 py-2.5 text-sm text-center text-gray-600">{{ e.line_count }}</td>
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(e.total_debit) }}</td>
                <td class="px-4 py-2.5 text-sm font-medium text-gray-900 text-right">{{ formatCurrency(e.total_credit) }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-semibold" :class="statusColor(e.status)">{{ e.status }}</span>
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-1">
                    <button v-if="e.status === 'draft'" @click="submitJournalEntry(e)" class="text-amber-600 hover:text-amber-800 text-sm font-medium" title="Submit for Approval">Submit</button>
                    <button v-if="e.status === 'pending_approval'" @click="approveJournalEntry(e)" class="text-blue-600 hover:text-blue-800 text-sm font-medium" title="Approve">Approve</button>
                    <button v-if="e.status === 'approved'" @click="postJournalEntry(e)" class="text-green-600 hover:text-green-800 text-sm font-medium" title="Post">Post</button>
                    <button v-if="e.status === 'posted' && !e.reversal_journal_id" @click="reverseJournalEntry(e)" class="text-red-500 hover:text-red-700 text-sm font-medium" title="Reverse">Reverse</button>
                    <button @click="viewJournalEntry(e)" class="text-blue-600 hover:text-blue-800 text-sm" title="View">View</button>
                  </div>
                </td>
              </tr>
              <tr v-if="journalEntries.length === 0">
                <td colspan="9" class="px-4 py-12 text-center text-gray-400">No journal entries found</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reports Tab -->
      <div v-if="activeTab === 'reports'">
        <div class="flex gap-3 mb-4">
          <button @click="reportType = 'trial-balance'" :class="reportType === 'trial-balance' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'" class="px-4 py-2 rounded-lg text-sm font-medium">Trial Balance</button>
          <button @click="reportType = 'income-statement'" :class="reportType === 'income-statement' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'" class="px-4 py-2 rounded-lg text-sm font-medium">Income Statement</button>
          <button @click="reportType = 'balance-sheet'" :class="reportType === 'balance-sheet' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'" class="px-4 py-2 rounded-lg text-sm font-medium">Balance Sheet</button>
          <button @click="reportType = 'cash-flow'" :class="reportType === 'cash-flow' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border'" class="px-4 py-2 rounded-lg text-sm font-medium">Cash Flow</button>

          <div class="ml-auto flex gap-2">
            <input v-model="reportFilters.from_date" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <input v-model="reportFilters.to_date" type="date" class="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <button @click="fetchReport" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Generate</button>
          </div>
        </div>

        <!-- Trial Balance -->
        <div v-if="reportType === 'trial-balance' && reportData" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-white">
            <h3 class="text-lg font-bold text-gray-900">Neraca Saldo / Trial Balance</h3>
            <p class="text-sm text-gray-500">Per {{ reportFilters.to_date }}</p>
          </div>
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Code</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-700">Account</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700">Debit</th>
                <th class="px-6 py-3 text-right text-xs font-semibold text-gray-700">Credit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="a in reportData" :key="a.id" :class="a.is_header ? 'bg-gray-50 font-semibold' : 'hover:bg-blue-50/40'">
                <td class="px-6 py-2 text-sm font-mono text-gray-600">{{ a.account_code }}</td>
                <td class="px-6 py-2 text-sm" :class="a.is_header ? 'font-bold' : ''">{{ a.account_name }}</td>
                <td class="px-6 py-2 text-sm font-medium text-right text-gray-900">
                  {{ a.normal_balance === 'debit' && Number(a.balance || 0) > 0 ? formatCurrency(a.balance) : '' }}
                </td>
                <td class="px-6 py-2 text-sm font-medium text-right text-gray-900">
                  {{ a.normal_balance === 'credit' && Number(a.balance || 0) > 0 ? formatCurrency(a.balance) : '' }}
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-indigo-50 font-bold border-t-2 border-indigo-200">
              <tr>
                <td class="px-6 py-3 text-sm" colspan="2">TOTAL</td>
                <td class="px-6 py-3 text-sm text-right">{{ formatCurrency(trialBalanceDebit) }}</td>
                <td class="px-6 py-3 text-sm text-right">{{ formatCurrency(trialBalanceCredit) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Income Statement -->
        <div v-if="reportType === 'income-statement' && reportData" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-white">
            <h3 class="text-lg font-bold text-gray-900">Laporan Laba Rugi / Income Statement</h3>
            <p class="text-sm text-gray-500">{{ reportFilters.from_date }} — {{ reportFilters.to_date }}</p>
          </div>
          <div class="p-6 space-y-4">
            <!-- Revenue -->
            <div>
              <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">Pendapatan</h4>
              <div v-for="r in reportData.revenue" :key="r.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700 pl-4">{{ r.account_name }}</span>
                <span class="text-sm font-medium">{{ formatCurrency(r.amount) }}</span>
              </div>
              <div class="flex justify-between py-1 font-bold border-t mt-1">
                <span class="text-sm">Total Pendapatan</span>
                <span class="text-sm text-green-700">{{ formatCurrency(reportData.totalRevenue) }}</span>
              </div>
            </div>
            <!-- COGS -->
            <div>
              <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">Beban Pokok Penjualan</h4>
              <div v-for="r in reportData.cogs" :key="r.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700 pl-4">{{ r.account_name }}</span>
                <span class="text-sm font-medium">({{ formatCurrency(r.amount) }})</span>
              </div>
              <div class="flex justify-between py-1 font-bold border-t mt-1">
                <span class="text-sm">Total COGS</span>
                <span class="text-sm text-red-700">({{ formatCurrency(reportData.totalCogs) }})</span>
              </div>
            </div>
            <!-- Gross Profit -->
            <div class="flex justify-between py-2 font-bold bg-green-50 px-4 rounded-lg">
              <span>LABA KOTOR</span>
              <span class="text-green-700">{{ formatCurrency(reportData.grossProfit) }}</span>
            </div>
            <!-- Opex -->
            <div>
              <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">Beban Usaha</h4>
              <div v-for="r in reportData.expenses" :key="r.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700 pl-4">{{ r.account_name }}</span>
                <span class="text-sm font-medium">({{ formatCurrency(r.amount) }})</span>
              </div>
              <div class="flex justify-between py-1 font-bold border-t mt-1">
                <span class="text-sm">Total Beban Usaha</span>
                <span class="text-sm text-red-700">({{ formatCurrency(reportData.totalExpenses) }})</span>
              </div>
            </div>
            <!-- Operating Income -->
            <div class="flex justify-between py-2 font-bold bg-blue-50 px-4 rounded-lg">
              <span>LABA USAHA</span>
              <span :class="reportData.operatingIncome >= 0 ? 'text-blue-700' : 'text-red-700'">{{ formatCurrency(reportData.operatingIncome) }}</span>
            </div>
            <!-- Other -->
            <div v-if="reportData.otherIncome?.length">
              <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">Pendapatan/Beban Lain-lain</h4>
              <div v-for="r in reportData.otherIncome" :key="r.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700 pl-4">{{ r.account_name }}</span>
                <span class="text-sm font-medium">{{ formatCurrency(r.amount) }}</span>
              </div>
            </div>
            <!-- Tax -->
            <div v-if="reportData.tax?.length">
              <h4 class="font-bold text-gray-800 border-b pb-1 mb-2">Beban Pajak</h4>
              <div v-for="r in reportData.tax" :key="r.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700 pl-4">{{ r.account_name }}</span>
                <span class="text-sm font-medium">({{ formatCurrency(r.amount) }})</span>
              </div>
            </div>
            <!-- Net Income -->
            <div class="flex justify-between py-3 font-bold text-lg bg-gradient-to-r from-indigo-100 to-purple-50 px-4 rounded-lg border-2 border-indigo-200">
              <span>LABA BERSIH</span>
              <span :class="reportData.netIncome >= 0 ? 'text-green-700' : 'text-red-700'">{{ formatCurrency(reportData.netIncome) }}</span>
            </div>
          </div>
        </div>

        <!-- Balance Sheet -->
        <div v-if="reportType === 'balance-sheet' && reportData" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-white">
            <h3 class="text-lg font-bold text-gray-900">Neraca / Balance Sheet</h3>
            <p class="text-sm text-gray-500">Per {{ reportData.as_of_date }}</p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x">
            <!-- Assets -->
            <div class="p-6">
              <h4 class="font-bold text-gray-800 text-lg mb-3 border-b pb-2">ASET</h4>
              <div v-for="a in reportData.assets" :key="a.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700">{{ a.account_name }}</span>
                <span class="text-sm font-medium">{{ formatCurrency(a.balance) }}</span>
              </div>
              <div class="flex justify-between py-2 font-bold border-t-2 border-blue-200 mt-3 bg-blue-50 px-2 rounded">
                <span>TOTAL ASET</span>
                <span class="text-blue-700">{{ formatCurrency(reportData.totalAssets) }}</span>
              </div>
            </div>
            <!-- Liabilities + Equity -->
            <div class="p-6">
              <h4 class="font-bold text-gray-800 text-lg mb-3 border-b pb-2">LIABILITAS</h4>
              <div v-for="a in reportData.liabilities" :key="a.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700">{{ a.account_name }}</span>
                <span class="text-sm font-medium">{{ formatCurrency(a.balance) }}</span>
              </div>
              <div class="flex justify-between py-1 font-bold border-t mt-2">
                <span class="text-sm">Total Liabilitas</span>
                <span class="text-sm">{{ formatCurrency(reportData.totalLiabilities) }}</span>
              </div>

              <h4 class="font-bold text-gray-800 text-lg mt-4 mb-3 border-b pb-2">EKUITAS</h4>
              <div v-for="a in reportData.equity" :key="a.account_code" class="flex justify-between py-1">
                <span class="text-sm text-gray-700">{{ a.account_name }}</span>
                <span class="text-sm font-medium">{{ formatCurrency(a.balance) }}</span>
              </div>
              <div class="flex justify-between py-1 font-bold border-t mt-2">
                <span class="text-sm">Total Ekuitas</span>
                <span class="text-sm">{{ formatCurrency(reportData.totalEquity) }}</span>
              </div>

              <div class="flex justify-between py-2 font-bold border-t-2 border-blue-200 mt-3 bg-blue-50 px-2 rounded">
                <span>TOTAL L + E</span>
                <span class="text-blue-700">{{ formatCurrency(reportData.totalLiabilitiesAndEquity) }}</span>
              </div>
              <div v-if="reportData.isBalanced" class="mt-2 text-center">
                <span class="text-green-600 text-xs font-semibold">✅ Balanced</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Cash Flow -->
        <div v-if="reportType === 'cash-flow' && reportData" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 to-white">
            <h3 class="text-lg font-bold text-gray-900">Laporan Arus Kas / Cash Flow Statement</h3>
            <p class="text-sm text-gray-500">{{ reportFilters.from_date }} — {{ reportFilters.to_date }}</p>
          </div>
          <div class="p-6 space-y-4">
            <div class="flex justify-between py-2 bg-gray-50 px-4 rounded">
              <span class="font-medium">Saldo Awal Kas</span>
              <span class="font-bold">{{ formatCurrency(reportData.openingBalance) }}</span>
            </div>
            <div v-for="cf in reportData.cashFlow" :key="cf.reference_type" class="flex justify-between py-1 px-4">
              <span class="text-sm text-gray-700">{{ cf.reference_type || 'Other' }}</span>
              <div class="text-right">
                <span class="text-sm text-green-600 mr-4">In: {{ formatCurrency(cf.cash_in) }}</span>
                <span class="text-sm text-red-600 mr-4">Out: {{ formatCurrency(cf.cash_out) }}</span>
                <span class="text-sm font-bold" :class="Number(cf.net_flow) >= 0 ? 'text-green-700' : 'text-red-700'">{{ formatCurrency(cf.net_flow) }}</span>
              </div>
            </div>
            <div class="flex justify-between py-2 font-bold bg-purple-50 px-4 rounded border-t-2 border-purple-200">
              <span>Kenaikan/(Penurunan) Kas</span>
              <span :class="reportData.totalNetFlow >= 0 ? 'text-green-700' : 'text-red-700'">{{ formatCurrency(reportData.totalNetFlow) }}</span>
            </div>
            <div class="flex justify-between py-2 font-bold text-lg bg-gradient-to-r from-indigo-100 to-purple-50 px-4 rounded border-2 border-indigo-200">
              <span>Saldo Akhir Kas</span>
              <span class="text-indigo-700">{{ formatCurrency(reportData.closingBalance) }}</span>
            </div>
          </div>
        </div>

        <div v-if="!reportData && activeTab === 'reports'" class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          Select a report type and date range, then click "Generate"
        </div>
      </div>
    </div>

    <!-- COA Modal -->
    <div v-if="showCoaModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div class="px-6 py-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900">{{ editingCoaId ? 'Edit Account' : 'Add Account' }}</h3>
          <button @click="showCoaModal = false" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="px-6 py-4 space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Account Code *</label>
              <input v-model="coaForm.account_code" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. 1111" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select v-model="coaForm.account_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="cogs">COGS</option>
                <option value="expense">Expense</option>
                <option value="other_income">Other Income</option>
                <option value="tax">Tax</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
            <input v-model="coaForm.account_name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Normal Balance *</label>
              <select v-model="coaForm.normal_balance" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <input v-model.number="coaForm.level" type="number" min="1" max="5" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="coaForm.is_header" type="checkbox" class="w-4 h-4 rounded" />
                <span class="text-sm font-medium text-gray-700">Header</span>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input v-model="coaForm.description" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div v-if="!editingCoaId">
            <label class="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
            <input v-model.number="coaForm.opening_balance" type="number" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div class="px-6 py-4 border-t flex justify-end gap-3">
          <button @click="showCoaModal = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="saveCOA" :disabled="saving" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Journal Entry Modal -->
    <div v-if="showJournalModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-900">{{ viewingEntry ? 'Journal Entry Detail' : 'New Journal Entry' }}</h3>
          <button @click="showJournalModal = false" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        <div class="px-6 py-4 overflow-y-auto flex-1">
          <!-- View mode -->
          <div v-if="viewingEntry" class="space-y-4">
            <div class="grid grid-cols-3 gap-4">
              <div><span class="text-xs text-gray-500">Entry #</span><p class="font-mono font-bold">{{ viewingEntry.entry_number }}</p></div>
              <div><span class="text-xs text-gray-500">Date</span><p class="font-medium">{{ formatDate(viewingEntry.entry_date) }}</p></div>
              <div><span class="text-xs text-gray-500">Status</span><p><span class="px-2.5 py-1 rounded-full text-xs font-semibold" :class="statusColor(viewingEntry.status)">{{ viewingEntry.status }}</span></p></div>
            </div>
            <div><span class="text-xs text-gray-500">Description</span><p class="text-gray-800">{{ viewingEntry.description }}</p></div>
            <table class="w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead class="bg-gray-50"><tr>
                <th class="px-4 py-2 text-left text-xs font-semibold">Account</th>
                <th class="px-4 py-2 text-left text-xs font-semibold">Description</th>
                <th class="px-4 py-2 text-right text-xs font-semibold">Debit</th>
                <th class="px-4 py-2 text-right text-xs font-semibold">Credit</th>
              </tr></thead>
              <tbody class="divide-y">
                <tr v-for="l in viewingEntry.lines" :key="l.id">
                  <td class="px-4 py-2 text-sm"><span class="font-mono text-gray-500">{{ l.account_code }}</span> {{ l.account_name }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ l.description || '—' }}</td>
                  <td class="px-4 py-2 text-sm text-right font-medium">{{ Number(l.debit) > 0 ? formatCurrency(l.debit) : '' }}</td>
                  <td class="px-4 py-2 text-sm text-right font-medium">{{ Number(l.credit) > 0 ? formatCurrency(l.credit) : '' }}</td>
                </tr>
              </tbody>
              <tfoot class="bg-indigo-50 font-bold"><tr>
                <td class="px-4 py-2 text-sm" colspan="2">TOTAL</td>
                <td class="px-4 py-2 text-sm text-right">{{ formatCurrency(viewingEntry.total_debit) }}</td>
                <td class="px-4 py-2 text-sm text-right">{{ formatCurrency(viewingEntry.total_credit) }}</td>
              </tr></tfoot>
            </table>
          </div>

          <!-- Create mode -->
          <div v-else class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Entry Date *</label>
                <input v-model="jeForm.entry_date" type="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Reference Type</label>
                <select v-model="jeForm.reference_type" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">None</option>
                  <option value="invoice">Invoice</option>
                  <option value="payment">Payment</option>
                  <option value="purchase">Purchase</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="payroll">Payroll</option>
                  <option value="depreciation">Depreciation</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input v-model="jeForm.description" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. Penjualan ke PT ABC" />
            </div>

            <!-- Journal Lines -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="text-sm font-bold text-gray-700">Journal Lines</label>
                <button @click="addJournalLine" class="text-blue-600 hover:text-blue-800 text-sm font-medium">+ Add Line</button>
              </div>
              <table class="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead class="bg-gray-50"><tr>
                  <th class="px-3 py-2 text-left text-xs font-semibold">Account</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold">Description</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold w-32">Debit</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold w-32">Credit</th>
                  <th class="px-3 py-2 w-10"></th>
                </tr></thead>
                <tbody class="divide-y">
                  <tr v-for="(line, i) in jeForm.lines" :key="i">
                    <td class="px-3 py-1.5">
                      <select v-model="line.account_id" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                        <option value="">Select account...</option>
                        <option v-for="a in detailAccounts" :key="a.id" :value="a.id">{{ a.account_code }} — {{ a.account_name }}</option>
                      </select>
                    </td>
                    <td class="px-3 py-1.5">
                      <input v-model="line.description" type="text" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </td>
                    <td class="px-3 py-1.5">
                      <input v-model.number="line.debit" type="number" min="0" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right" @input="line.credit = 0" />
                    </td>
                    <td class="px-3 py-1.5">
                      <input v-model.number="line.credit" type="number" min="0" class="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right" @input="line.debit = 0" />
                    </td>
                    <td class="px-3 py-1.5 text-center">
                      <button v-if="jeForm.lines.length > 2" @click="jeForm.lines.splice(i, 1)" class="text-red-400 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                </tbody>
                <tfoot class="bg-gray-50 font-bold"><tr>
                  <td class="px-3 py-2 text-sm" colspan="2">TOTAL</td>
                  <td class="px-3 py-2 text-sm text-right" :class="isBalanced ? 'text-green-700' : 'text-red-700'">{{ formatCurrency(totalJeDebit) }}</td>
                  <td class="px-3 py-2 text-sm text-right" :class="isBalanced ? 'text-green-700' : 'text-red-700'">{{ formatCurrency(totalJeCredit) }}</td>
                  <td></td>
                </tr></tfoot>
              </table>
              <p v-if="!isBalanced" class="text-red-500 text-xs mt-1">⚠ Debit and Credit must be equal. Difference: {{ formatCurrency(Math.abs(totalJeDebit - totalJeCredit)) }}</p>
            </div>
          </div>
        </div>
        <div v-if="!viewingEntry" class="px-6 py-4 border-t flex justify-end gap-3">
          <button @click="showJournalModal = false" class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="saveJournalEntry" :disabled="saving || !isBalanced || !jeForm.description || !jeForm.entry_date" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save as Draft' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div :class="toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'" class="text-white px-5 py-3 rounded-lg shadow-lg">{{ toast.message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { api } from '../lib/api';

const activeTab = ref('dashboard');
const saving = ref(false);
const toast = ref<{ type: string; message: string } | null>(null);
const showToast = (type: string, message: string) => {
  toast.value = { type, message };
  setTimeout(() => { toast.value = null; }, 3000);
};

const formatCurrency = (v: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v) || 0);
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const tabClass = (tab: string) => activeTab.value === tab
  ? 'bg-blue-600 text-white shadow-sm'
  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50';

const statusColor = (s: string) => ({
  draft: 'bg-yellow-100 text-yellow-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  posted: 'bg-green-100 text-green-800',
  reversed: 'bg-red-100 text-red-800',
}[s] || 'bg-gray-100 text-gray-800');

const typeLabel = (t: string) => ({
  asset: 'Aset', liability: 'Liabilitas', equity: 'Ekuitas',
  revenue: 'Pendapatan', cogs: 'COGS', expense: 'Beban',
  other_income: 'Lain-lain', tax: 'Pajak'
}[t] || t);

const typeColor = (t: string) => ({
  asset: 'text-blue-600', liability: 'text-red-600', equity: 'text-purple-600',
  revenue: 'text-green-600', cogs: 'text-orange-600', expense: 'text-red-500',
  other_income: 'text-cyan-600', tax: 'text-yellow-700'
}[t] || 'text-gray-600');

const typeBadge = (t: string) => ({
  asset: 'bg-blue-50 text-blue-700', liability: 'bg-red-50 text-red-700', equity: 'bg-purple-50 text-purple-700',
  revenue: 'bg-green-50 text-green-700', cogs: 'bg-orange-50 text-orange-700', expense: 'bg-red-50 text-red-600',
  other_income: 'bg-cyan-50 text-cyan-700', tax: 'bg-yellow-50 text-yellow-700'
}[t] || 'bg-gray-100 text-gray-700');

// ===== DASHBOARD =====
const dashboard = reactive<any>({ summary: {}, currentPeriod: null, recentEntries: [], typeSummary: [] });
const fetchDashboard = async () => {
  try {
    const { data } = await api.get('/gl/dashboard');
    Object.assign(dashboard, data.data || {});
  } catch (e) { console.error('Dashboard error:', e); }
};

// ===== COA =====
const coaAccounts = ref<any[]>([]);
const coaFilter = ref('');
const coaSearch = ref('');
const showCoaModal = ref(false);
const editingCoaId = ref<number | null>(null);
const coaForm = reactive({
  account_code: '', account_name: '', account_type: 'asset',
  normal_balance: 'debit', level: 1, is_header: false,
  description: '', opening_balance: 0
});

const filteredCOA = computed(() => {
  let list = coaAccounts.value;
  if (coaSearch.value) {
    const q = coaSearch.value.toLowerCase();
    list = list.filter(a => a.account_code.includes(q) || a.account_name.toLowerCase().includes(q));
  }
  return list;
});

const detailAccounts = computed(() => coaAccounts.value.filter(a => !a.is_header && a.is_active));

const fetchCOA = async () => {
  try {
    const params: any = { active_only: 'true' };
    if (coaFilter.value) params.type = coaFilter.value;
    const { data } = await api.get('/gl/coa', { params });
    coaAccounts.value = data.data || [];
  } catch (e) { console.error('COA error:', e); }
};

const openCoaModal = (account?: any) => {
  if (account) {
    editingCoaId.value = account.id;
    Object.assign(coaForm, {
      account_code: account.account_code, account_name: account.account_name,
      account_type: account.account_type, normal_balance: account.normal_balance,
      level: account.level, is_header: !!account.is_header,
      description: account.description || '', opening_balance: account.opening_balance || 0
    });
  } else {
    editingCoaId.value = null;
    Object.assign(coaForm, { account_code: '', account_name: '', account_type: 'asset', normal_balance: 'debit', level: 1, is_header: false, description: '', opening_balance: 0 });
  }
  showCoaModal.value = true;
};

const saveCOA = async () => {
  saving.value = true;
  try {
    if (editingCoaId.value) {
      await api.put(`/gl/coa/${editingCoaId.value}`, coaForm);
      showToast('success', 'Account updated');
    } else {
      await api.post('/gl/coa', coaForm);
      showToast('success', 'Account created');
    }
    showCoaModal.value = false;
    fetchCOA();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed');
  } finally { saving.value = false; }
};

const deleteCOA = async (a: any) => {
  if (!confirm(`Delete account "${a.account_code} — ${a.account_name}"?`)) return;
  try {
    await api.delete(`/gl/coa/${a.id}`);
    showToast('success', 'Account deleted');
    fetchCOA();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed');
  }
};

// ===== JOURNAL ENTRIES =====
const journalEntries = ref<any[]>([]);
const jeFilter = reactive({ status: '', from_date: '', to_date: '' });
const showJournalModal = ref(false);
const viewingEntry = ref<any>(null);
const jeForm = reactive({
  entry_date: new Date().toISOString().split('T')[0],
  description: '', reference_type: '', reference_number: '',
  lines: [
    { account_id: '', description: '', debit: 0, credit: 0 },
    { account_id: '', description: '', debit: 0, credit: 0 },
  ]
});

const totalJeDebit = computed(() => jeForm.lines.reduce((s, l) => s + Number(l.debit || 0), 0));
const totalJeCredit = computed(() => jeForm.lines.reduce((s, l) => s + Number(l.credit || 0), 0));
const isBalanced = computed(() => Math.abs(totalJeDebit.value - totalJeCredit.value) < 0.01 && totalJeDebit.value > 0);

const fetchJournalEntries = async () => {
  try {
    const params: any = {};
    if (jeFilter.status) params.status = jeFilter.status;
    if (jeFilter.from_date) params.from_date = jeFilter.from_date;
    if (jeFilter.to_date) params.to_date = jeFilter.to_date;
    const { data } = await api.get('/gl/journal-entries', { params });
    journalEntries.value = data.data || [];
  } catch (e) { console.error('JE error:', e); }
};

const addJournalLine = () => {
  jeForm.lines.push({ account_id: '', description: '', debit: 0, credit: 0 });
};

const openJournalModal = () => {
  viewingEntry.value = null;
  jeForm.entry_date = new Date().toISOString().split('T')[0];
  jeForm.description = '';
  jeForm.reference_type = '';
  jeForm.reference_number = '';
  jeForm.lines = [
    { account_id: '', description: '', debit: 0, credit: 0 },
    { account_id: '', description: '', debit: 0, credit: 0 },
  ];
  showJournalModal.value = true;
};

const viewJournalEntry = async (e: any) => {
  try {
    const { data } = await api.get(`/gl/journal-entries/${e.id}`);
    viewingEntry.value = data.data;
    showJournalModal.value = true;
  } catch (err) { showToast('error', 'Failed to load'); }
};

const saveJournalEntry = async () => {
  saving.value = true;
  try {
    const idempotencyKey = `je-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await api.post('/gl/journal-entries', {
      entry_date: jeForm.entry_date,
      description: jeForm.description,
      lines: jeForm.lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0)),
      idempotency_key: idempotencyKey,
    });
    showToast('success', 'Journal entry created as draft');
    showJournalModal.value = false;
    fetchJournalEntries();
    fetchDashboard();
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed');
  } finally { saving.value = false; }
};

const submitJournalEntry = async (e: any) => {
  if (!confirm(`Submit journal "${e.entry_number}" for approval?`)) return;
  try {
    await api.post(`/gl/journal-entries/${e.id}/submit`);
    showToast('success', 'Journal submitted for approval');
    fetchJournalEntries();
  } catch (err: any) {
    showToast('error', err.response?.data?.error || 'Failed');
  }
};

const approveJournalEntry = async (e: any) => {
  if (!confirm(`Approve journal "${e.entry_number}"?`)) return;
  try {
    await api.post(`/gl/journal-entries/${e.id}/approve`);
    showToast('success', 'Journal approved');
    fetchJournalEntries();
  } catch (err: any) {
    showToast('error', err.response?.data?.error || 'Failed');
  }
};

const postJournalEntry = async (e: any) => {
  if (!confirm(`Post journal "${e.entry_number}"? This will create immutable accounting entries.`)) return;
  try {
    const idempotencyKey = `je-post-${e.id}-${Date.now()}`;
    await api.post(`/gl/journal-entries/${e.id}/post`, {}, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    showToast('success', 'Journal entry posted');
    fetchJournalEntries();
    fetchDashboard();
  } catch (err: any) {
    showToast('error', err.response?.data?.error || 'Failed');
  }
};

const reverseJournalEntry = async (e: any) => {
  const reason = prompt('Reason for reversing this journal?');
  if (!reason) return;
  try {
    const idempotencyKey = `je-reverse-${e.id}-${Date.now()}`;
    await api.post(`/gl/journal-entries/${e.id}/reverse`, { reason }, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
    showToast('success', 'Journal entry reversed (new reversal journal created)');
    fetchJournalEntries();
    fetchDashboard();
  } catch (err: any) {
    showToast('error', err.response?.data?.error || 'Failed');
  }
};

// ===== REPORTS =====
const reportType = ref('trial-balance');
const reportData = ref<any>(null);
const reportFilters = reactive({
  from_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
  to_date: new Date().toISOString().split('T')[0]
});

const trialBalanceDebit = computed(() => {
  if (!Array.isArray(reportData.value)) return 0;
  return reportData.value.filter((a: any) => a.normal_balance === 'debit').reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
});
const trialBalanceCredit = computed(() => {
  if (!Array.isArray(reportData.value)) return 0;
  return reportData.value.filter((a: any) => a.normal_balance === 'credit').reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
});

const fetchReport = async () => {
  try {
    reportData.value = null;
    let res;
    switch (reportType.value) {
      case 'trial-balance':
        res = await api.get('/gl/trial-balance', { params: { as_of_date: reportFilters.to_date } });
        reportData.value = res.data.data;
        break;
      case 'income-statement':
        res = await api.get('/gl/reports/income-statement', { params: { from_date: reportFilters.from_date, to_date: reportFilters.to_date } });
        reportData.value = res.data.data;
        break;
      case 'balance-sheet':
        res = await api.get('/gl/reports/balance-sheet', { params: { as_of_date: reportFilters.to_date } });
        reportData.value = res.data.data;
        break;
      case 'cash-flow':
        res = await api.get('/gl/reports/cash-flow', { params: { from_date: reportFilters.from_date, to_date: reportFilters.to_date } });
        reportData.value = res.data.data;
        break;
    }
  } catch (e: any) {
    showToast('error', e.response?.data?.error || 'Failed to generate report');
  }
};

watch(activeTab, (tab) => {
  if (tab === 'dashboard') fetchDashboard();
  else if (tab === 'coa') fetchCOA();
  else if (tab === 'journals') { fetchJournalEntries(); fetchCOA(); }
});

onMounted(() => {
  fetchDashboard();
  fetchCOA();
});
</script>

<style scoped>
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fade-in 0.2s ease-out; }
</style>
