let transactions = JSON.parse(localStorage.getItem('finvault_tx')) || [];
let accounts = JSON.parse(localStorage.getItem('finvault_accounts')) || [];
let categories = JSON.parse(localStorage.getItem('finvault_categories')) || {};
let budgets = JSON.parse(localStorage.getItem('finvault_budgets')) || {};
let debts = JSON.parse(localStorage.getItem('finvault_debts')) || [];
let reminders = JSON.parse(localStorage.getItem('finvault_reminders')) || [];
let goals = JSON.parse(localStorage.getItem('finvault_goals')) || [];
let settings = JSON.parse(localStorage.getItem('finvault_settings')) || { notification: false };
let mainChart = null, donutChart = null;
let isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
let searchTimeout;

const defaultExpenseCategories = ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Investasi', 'Tarik Tunai', 'Top Up E-Wallet', 'Lainnya'];
const defaultIncomeCategories = ['Gaji', 'Bonus', 'Freelance', 'Hadiah', 'Bunga Bank', 'Lainnya'];

if (!categories.expense) {
    categories = { expense: defaultExpenseCategories, income: defaultIncomeCategories };
    localStorage.setItem('finvault_categories', JSON.stringify(categories));
}

const CATEGORY_ICONS = {
    'Makan & Minum':'fa-utensils','Transportasi':'fa-car','Belanja':'fa-bag-shopping','Tagihan':'fa-bolt','Hiburan':'fa-gamepad','Kesehatan':'fa-heart-pulse',
    'Pendidikan':'fa-graduation-cap','Investasi':'fa-chart-line','Tarik Tunai':'fa-hand-holding-dollar','Top Up E-Wallet':'fa-wallet','Lainnya':'fa-ellipsis',
    'Gaji':'fa-money-bill-wave','Bonus':'fa-certificate','Freelance':'fa-laptop-code','Hadiah':'fa-gift','Bunga Bank':'fa-building-columns'
};

function formatIDR(num, currency = 'IDR') {
    if (currency === 'IDR') return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
}

function formatDateIndo(dateStr) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatMonthIndo(monthStr) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const [y, m] = monthStr.split('-');
    return `${months[parseInt(m) - 1]} ${y}`;
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('invisible', 'opacity-0', 'translate-y-2');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('invisible', 'opacity-0', 'translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, duration);
}

function updateGreeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
    document.getElementById('greeting').innerText = `Hai, selamat ${greeting}`;
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function toggleSidebarCollapse() {
    if (window.innerWidth < 1024) return;
    isSidebarCollapsed = !isSidebarCollapsed;
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const icon = document.getElementById('collapse-icon');
    if (isSidebarCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        main.style.marginLeft = '5rem';
        icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        main.style.marginLeft = '18rem';
        icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
    }
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('mobile-overlay').classList.toggle('hidden');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('mobile-overlay').classList.add('hidden');
}

function migrateData() {
    if (accounts.length === 0) {
        const accountSet = new Set();
        transactions.forEach(t => accountSet.add(t.account || 'Cash'));
        accountSet.forEach(name => accounts.push({ id: Date.now() + Math.random(), name, initialBalance: 0, currency: 'IDR' }));
        localStorage.setItem('finvault_accounts', JSON.stringify(accounts));
    }
}

function getAccountBalance(accountId) {
    const account = accounts.find(a => a.id == accountId);
    if (!account) return 0;
    let balance = account.initialBalance || 0;
    transactions.forEach(t => {
        if (t.account == accountId) {
            if (t.type === 'income') balance += t.amount;
            else if (t.type === 'expense') balance -= t.amount;
        }
        if (t.type === 'transfer') {
            if (t.account == accountId) balance -= t.amount;
            if (t.toAccount == accountId) balance += t.amount;
        }
    });
    return balance;
}

function renderAccounts() {
    const container = document.getElementById('account-list');
    if (!container) return;
    container.innerHTML = accounts.map(acc => {
        const balance = getAccountBalance(acc.id);
        return `
        <div class="glass bg-white/40 dark:bg-dark-surface/40 p-4 rounded-2xl border border-slate-200/30 dark:border-dark-border/50 flex items-center justify-between hover:shadow-md transition-shadow">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-brand-100/60 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    <i class="fa-solid ${acc.name.toLowerCase().includes('cash') ? 'fa-money-bill' : 'fa-building-columns'}"></i>
                </div>
                <div>
                    <p class="font-bold text-sm">${acc.name}</p>
                    <p class="text-[9px] text-slate-400">${acc.currency} • Saldo awal ${formatIDR(acc.initialBalance, acc.currency)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-black text-sm ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatIDR(balance, acc.currency)}</p>
                <div class="flex gap-1 mt-1">
                    <button onclick="editAccount(${acc.id})" class="text-xs text-slate-400 hover:text-brand-500"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteAccount(${acc.id})" class="text-xs text-slate-400 hover:text-rose-500"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    if (accounts.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4">Belum ada akun. Tambahkan akun baru.</div>';
}

function openAccountModal(account = null) {
    document.getElementById('account-modal').classList.remove('hidden');
    document.getElementById('account-modal').classList.add('flex');
    if (account) {
        document.getElementById('account-modal-title').innerText = 'Edit Akun';
        document.getElementById('account-id').value = account.id;
        document.getElementById('account-name').value = account.name;
        document.getElementById('account-balance').value = account.initialBalance;
        document.getElementById('account-currency').value = account.currency;
    } else {
        document.getElementById('account-modal-title').innerText = 'Tambah Akun';
        document.getElementById('account-id').value = '';
        document.getElementById('account-name').value = '';
        document.getElementById('account-balance').value = '0';
        document.getElementById('account-currency').value = 'IDR';
    }
}

function closeAccountModal() {
    document.getElementById('account-modal').classList.add('hidden');
    document.getElementById('account-modal').classList.remove('flex');
}

function saveAccount(e) {
    e.preventDefault();
    const id = document.getElementById('account-id').value;
    const name = document.getElementById('account-name').value.trim();
    const initialBalance = parseFloat(document.getElementById('account-balance').value) || 0;
    const currency = document.getElementById('account-currency').value;
    if (!name) return;
    if (id) {
        const index = accounts.findIndex(a => a.id == id);
        if (index !== -1) {
            accounts[index] = { ...accounts[index], name, initialBalance, currency };
        }
    } else {
        accounts.push({ id: Date.now(), name, initialBalance, currency });
    }
    localStorage.setItem('finvault_accounts', JSON.stringify(accounts));
    closeAccountModal();
    renderAccounts();
    populateAccountSelects();
    refreshAll();
    showToast('Akun disimpan');
}

function deleteAccount(id) {
    if (confirm('Hapus akun ini? Semua transaksi terkait akan tetap ada.')) {
        accounts = accounts.filter(a => a.id != id);
        localStorage.setItem('finvault_accounts', JSON.stringify(accounts));
        renderAccounts();
        populateAccountSelects();
        refreshAll();
        showToast('Akun dihapus');
    }
}

function editAccount(id) {
    const account = accounts.find(a => a.id == id);
    if (account) openAccountModal(account);
}

function renderCategories() {
    const incomeList = document.getElementById('category-income-list');
    const expenseList = document.getElementById('category-expense-list');
    if (!incomeList || !expenseList) return;
    incomeList.innerHTML = (categories.income || []).map(cat => `
        <div class="flex items-center justify-between p-2 bg-white/40 dark:bg-dark-surface/40 rounded-xl">
            <span class="text-sm">${cat}</span>
            <button onclick="deleteCategory('income', '${cat}')" class="text-slate-400 hover:text-rose-500"><i class="fa-regular fa-trash-can text-xs"></i></button>
        </div>
    `).join('');
    expenseList.innerHTML = (categories.expense || []).map(cat => `
        <div class="flex items-center justify-between p-2 bg-white/40 dark:bg-dark-surface/40 rounded-xl">
            <span class="text-sm">${cat}</span>
            <button onclick="deleteCategory('expense', '${cat}')" class="text-slate-400 hover:text-rose-500"><i class="fa-regular fa-trash-can text-xs"></i></button>
        </div>
    `).join('');
}

function openCategoryModal() {
    document.getElementById('category-modal').classList.remove('hidden');
    document.getElementById('category-modal').classList.add('flex');
    document.getElementById('category-id').value = '';
    document.getElementById('category-name').value = '';
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
    document.getElementById('category-modal').classList.remove('flex');
}

function saveCategory(e) {
    e.preventDefault();
    const type = document.querySelector('input[name="cat-type"]:checked').value;
    const name = document.getElementById('category-name').value.trim();
    if (!name) return;
    if (!categories[type].includes(name)) {
        categories[type].push(name);
        localStorage.setItem('finvault_categories', JSON.stringify(categories));
    }
    closeCategoryModal();
    renderCategories();
    populateCategorySelects();
    showToast('Kategori ditambahkan');
}

function deleteCategory(type, name) {
    if (confirm(`Hapus kategori "${name}"?`)) {
        categories[type] = categories[type].filter(c => c !== name);
        localStorage.setItem('finvault_categories', JSON.stringify(categories));
        renderCategories();
        populateCategorySelects();
        showToast('Kategori dihapus');
    }
}

function populateAccountSelects() {
    const selects = ['f-account', 'f-to-account', 'tx-account-filter'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        if (id === 'tx-account-filter') {
            select.innerHTML = '<option value="all">Semua Akun</option>';
        }
        accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.textContent = acc.name;
            select.appendChild(option);
        });
    });
}

function populateCategorySelects() {
    const catSelect = document.getElementById('f-category');
    if (!catSelect) return;
    const type = document.getElementById('f-type').value;
    catSelect.innerHTML = '';
    (categories[type] || []).forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        catSelect.appendChild(option);
    });
}

function setFormType(type) {
    document.getElementById('f-type').value = type;
    document.getElementById('type-exp').className = type === 'expense' ? 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold bg-white dark:bg-dark-surface text-rose-600 shadow-sm transition-all' : 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-500 transition-all';
    document.getElementById('type-inc').className = type === 'income' ? 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold bg-white dark:bg-dark-surface text-emerald-600 shadow-sm transition-all' : 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-500 transition-all';
    document.getElementById('type-transfer').className = type === 'transfer' ? 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold bg-white dark:bg-dark-surface text-brand-600 shadow-sm transition-all' : 'py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-500 transition-all';
    
    const accountField = document.getElementById('account-field');
    const toAccountField = document.getElementById('to-account-field');
    const categoryField = document.getElementById('category-field');
    
    if (type === 'transfer') {
        accountField.classList.remove('hidden');
        toAccountField.classList.remove('hidden');
        categoryField.classList.add('hidden');
        document.getElementById('f-account').required = true;
        document.getElementById('f-to-account').required = true;
    } else {
        accountField.classList.remove('hidden');
        toAccountField.classList.add('hidden');
        categoryField.classList.remove('hidden');
        document.getElementById('f-account').required = true;
        document.getElementById('f-to-account').required = false;
        populateCategorySelects();
    }
}

function openModal(tx = null) {
    document.getElementById('tx-modal').classList.remove('hidden');
    document.getElementById('tx-modal').classList.add('flex');
    document.getElementById('f-date').valueAsDate = new Date();
    document.getElementById('recurring-options').classList.add('hidden');
    document.getElementById('f-recurring').checked = false;
    
    if (tx) {
        document.getElementById('modal-title').innerText = 'Edit Transaksi';
        document.getElementById('tx-id').value = tx.id;
        setFormType(tx.type);
        document.getElementById('f-amount').value = tx.amount;
        document.getElementById('f-date').value = tx.date;
        document.getElementById('f-account').value = tx.account;
        if (tx.type === 'transfer') {
            document.getElementById('f-to-account').value = tx.toAccount;
        } else {
            document.getElementById('f-category').value = tx.category;
        }
        document.getElementById('f-desc').value = tx.desc || '';
        document.getElementById('f-recurring').checked = tx.recurring || false;
        if (tx.recurring) {
            document.getElementById('recurring-options').classList.remove('hidden');
            document.getElementById('f-recurring-type').value = tx.recurringType || 'monthly';
        }
    } else {
        document.getElementById('modal-title').innerText = 'Transaksi Baru';
        document.getElementById('tx-id').value = '';
        setFormType('expense');
        document.getElementById('f-amount').value = '';
        document.getElementById('f-desc').value = '';
    }
}

function closeModal() {
    document.getElementById('tx-modal').classList.add('hidden');
    document.getElementById('tx-modal').classList.remove('flex');
}

function handleSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('tx-id').value;
    const type = document.getElementById('f-type').value;
    const amount = parseFloat(document.getElementById('f-amount').value);
    const date = document.getElementById('f-date').value;
    const account = document.getElementById('f-account').value;
    const toAccount = type === 'transfer' ? document.getElementById('f-to-account').value : null;
    const category = type !== 'transfer' ? document.getElementById('f-category').value : null;
    const desc = document.getElementById('f-desc').value;
    const recurring = document.getElementById('f-recurring').checked;
    const recurringType = recurring ? document.getElementById('f-recurring-type').value : null;

    if (type === 'transfer' && account === toAccount) {
        alert('Akun asal dan tujuan tidak boleh sama');
        return;
    }

    const txData = { type, amount, date, account, desc, recurring, recurringType };
    if (type === 'transfer') {
        txData.toAccount = toAccount;
        txData.category = 'Transfer';
    } else {
        txData.category = category;
    }

    if (id) {
        transactions = transactions.filter(t => t.id != id && t.transferId != id);
    }

    if (type === 'transfer') {
        const transferId = Date.now();
        const fromAccountName = accounts.find(a => a.id == account)?.name || 'Unknown';
        const toAccountName = accounts.find(a => a.id == toAccount)?.name || 'Unknown';
        const txOut = { ...txData, id: transferId, type: 'expense', account, toAccount: undefined, desc: `Transfer ke ${toAccountName}` };
        const txIn = { ...txData, id: transferId + 1, type: 'income', account: toAccount, desc: `Transfer dari ${fromAccountName}`, transferId };
        transactions.unshift(txOut, txIn);
    } else {
        const newTx = { ...txData, id: Date.now() };
        transactions.unshift(newTx);
        if (recurring) generateRecurringTransactions(newTx);
    }

    localStorage.setItem('finvault_tx', JSON.stringify(transactions));
    refreshAll();
    if (!document.getElementById('view-transactions').classList.contains('hidden')) renderFullTransactions();
    closeModal();
    showToast('Transaksi disimpan');
}

function generateRecurringTransactions(tx) {
    const interval = { daily: 1, weekly: 7, monthly: 30 }[tx.recurringType];
    if (!interval) return;
    const startDate = new Date(tx.date);
    for (let i = 1; i <= 12; i++) {
        const nextDate = new Date(startDate);
        nextDate.setDate(startDate.getDate() + interval * i);
        if (nextDate > new Date(new Date().setMonth(new Date().getMonth() + 6))) break;
        transactions.push({ ...tx, id: Date.now() + i, date: nextDate.toISOString().split('T')[0] });
    }
}

function deleteTx(id) {
    if (confirm('Hapus transaksi ini?')) {
        transactions = transactions.filter(t => t.id !== id && t.transferId !== id);
        localStorage.setItem('finvault_tx', JSON.stringify(transactions));
        refreshAll();
        renderFullTransactions();
        showToast('Transaksi dihapus');
    }
}

function editTx(id) {
    const tx = transactions.find(t => t.id == id);
    if (tx) openModal(tx);
}

function calculateBalances() {
    const balanceMap = {};
    accounts.forEach(acc => {
        balanceMap[acc.id] = acc.initialBalance || 0;
    });
    transactions.forEach(t => {
        if (t.type === 'income') balanceMap[t.account] = (balanceMap[t.account] || 0) + t.amount;
        else if (t.type === 'expense') balanceMap[t.account] = (balanceMap[t.account] || 0) - t.amount;
        else if (t.type === 'transfer') {
            balanceMap[t.account] = (balanceMap[t.account] || 0) - t.amount;
            balanceMap[t.toAccount] = (balanceMap[t.toAccount] || 0) + t.amount;
        }
    });
    return balanceMap;
}

function renderAccountBalances() {
    const balances = calculateBalances();
    const total = Object.values(balances).reduce((a, b) => a + b, 0);
    document.getElementById('sidebar-balance').innerText = formatIDR(total);
    const container = document.getElementById('account-balance-list');
    if (!container) return;
    const sorted = Object.entries(balances).sort((a, b) => b[1] - a[1]);
    container.innerHTML = sorted.map(([accId, bal]) => {
        const acc = accounts.find(a => a.id == accId);
        if (!acc) return '';
        return `
        <div class="glass bg-white/40 dark:bg-dark-surface/40 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-200/30 dark:border-dark-border/50 flex items-center gap-2 md:gap-3 hover:shadow-md transition-shadow">
            <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-brand-100/60 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 text-sm md:text-base">
                <i class="fa-solid ${acc.name.toLowerCase().includes('cash') ? 'fa-money-bill' : 'fa-building-columns'}"></i>
            </div>
            <div class="min-w-0 flex-1">
                <p class="text-[9px] md:text-xs font-bold text-slate-400 uppercase truncate">${acc.name}</p>
                <p class="text-sm md:text-base font-black break-words ${bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatIDR(bal, acc.currency)}</p>
            </div>
        </div>`;
    }).join('');
    if (sorted.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs md:text-sm">Belum ada saldo akun</div>';
}

function updateDateLabel() {
    const input = document.getElementById('date-filter');
    const label = document.getElementById('date-label');
    if (input.value) {
        const [year, month] = input.value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        label.innerText = `${monthNames[parseInt(month)-1]} ${year}`;
    } else label.innerText = '';
}

function refreshAll() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter) && t.type !== 'transfer');
    const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('stat-income').innerText = formatIDR(inc);
    document.getElementById('stat-expense').innerText = formatIDR(exp);
    document.getElementById('stat-savings').innerText = formatIDR(inc - exp);
    document.getElementById('stat-count').innerText = filtered.length;
    renderAccountBalances();
    renderDashboardList(filtered);
    renderBudgets(filtered);
    updateCharts(filtered);
    renderReminders();
    renderGoals();
    renderDebts();
}

function renderDashboardList(data) {
    const list = document.getElementById('dashboard-tx-list');
    list.innerHTML = data.slice(0, 5).map(t => `<tr class="group hover:bg-slate-100/50 dark:hover:bg-dark-border/30 transition">
        <td class="px-4 md:px-6 py-3 md:py-4"><div class="flex items-center gap-2 md:gap-3"><div class="w-7 h-7 md:w-9 md:h-9 rounded-xl md:rounded-2xl bg-slate-200/50 dark:bg-dark-surface flex items-center justify-center text-slate-500 text-xs md:text-base"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-tag'}"></i></div><div><p class="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-300">${t.desc || t.category}</p><p class="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase">${t.date}</p></div></div></td>
        <td class="px-4 md:px-6 py-3 md:py-4 text-right font-black text-xs md:text-sm whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}">${t.type === 'income' ? '+' : '-'} ${formatIDR(t.amount)}</td></tr>`).join('');
    if (data.length === 0) list.innerHTML = '<tr><td colspan="2" class="p-6 md:p-10 text-center text-slate-400 text-xs md:text-sm">Belum ada transaksi</td></tr>';
}

function renderBudgets(data) {
    const container = document.getElementById('budget-progress-list');
    const expByCat = {};
    data.filter(t => t.type === 'expense').forEach(t => expByCat[t.category] = (expByCat[t.category] || 0) + t.amount);
    let html = '', totalLimit = 0, totalSpent = 0;
    (categories.expense || []).forEach(cat => {
        const limit = budgets[cat] || 0;
        if (limit > 0) {
            const spent = expByCat[cat] || 0;
            const perc = Math.min((spent / limit) * 100, 100);
            totalLimit += limit;
            totalSpent += spent;
            html += `<div><div class="flex justify-between text-[10px] md:text-xs font-bold mb-1"><span>${cat}</span><span class="${perc >= 90 ? 'text-rose-600' : 'text-slate-400'}">${perc.toFixed(0)}%</span></div>
            <div class="h-1.5 md:h-2 w-full bg-slate-200/60 dark:bg-dark-border rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style="width:${perc}%"></div></div>
            <div class="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-400 mt-1"><span>${formatIDR(spent)}</span><span>${formatIDR(limit)}</span></div></div>`;
        }
    });
    container.innerHTML = html || '<div class="text-center p-4 md:p-6 text-slate-400 text-xs md:text-sm">Belum ada anggaran diatur.</div>';
    document.getElementById('budget-percentage').innerText = totalLimit > 0 ? (totalSpent / totalLimit * 100).toFixed(0) + '%' : '0%';
}

function updateCharts(data) {
    const expByCat = {};
    data.filter(t => t.type === 'expense').forEach(t => expByCat[t.category] = (expByCat[t.category] || 0) + t.amount);
    const donutCtx = document.getElementById('donutChart').getContext('2d');
    if (donutChart) donutChart.destroy();
    donutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expByCat),
            datasets: [{
                data: Object.values(expByCat),
                backgroundColor: ['#6366f1','#818cf8','#a5b4fc','#c7d2fe','#e0e7ff','#4f46e5','#4338ca','#3730a3'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc' } } }
    });
    const legend = document.getElementById('chart-legend');
    legend.innerHTML = Object.entries(expByCat).slice(0, 5).map(([cat, val], i) => `
        <div class="flex justify-between items-center text-[10px] md:text-xs font-medium"><div class="flex items-center gap-1 md:gap-2"><div class="w-2 h-2 md:w-3 md:h-3 rounded-full" style="background:${donutChart.data.datasets[0].backgroundColor[i]}"></div><span>${cat}</span></div><span class="font-bold">${formatIDR(val)}</span></div>
    `).join('');
    
    const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const dailyInc = new Array(31).fill(0), dailyExp = new Array(31).fill(0);
    data.forEach(t => {
        const d = parseInt(t.date.split('-')[2]) - 1;
        if (t.type === 'income') dailyInc[d] += t.amount;
        else if (t.type === 'expense') dailyExp[d] += t.amount;
    });
    const mainCtx = document.getElementById('mainChart').getContext('2d');
    if (mainChart) mainChart.destroy();
    mainChart = new Chart(mainCtx, {
        type: 'line',
        data: {
            labels: days,
            datasets: [
                { label: 'Masuk', data: dailyInc, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.05)', tension: 0.2, fill: true, borderWidth: 2, pointRadius: 1, pointBackgroundColor: '#10b981' },
                { label: 'Keluar', data: dailyExp, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.05)', tension: 0.2, fill: true, borderWidth: 2, pointRadius: 1, pointBackgroundColor: '#ef4444' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
        }
    });
}

function renderFullTransactions() {
    const globalSearch = document.getElementById('tx-search').value.toLowerCase();
    const typeFilter = document.getElementById('tx-type-filter').value;
    const accountFilter = document.getElementById('tx-account-filter').value;
    const filtered = transactions.filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        if (accountFilter !== 'all' && t.account != accountFilter && t.toAccount != accountFilter) return false;
        const matchGlobal = (t.desc || '').toLowerCase().includes(globalSearch) || (t.category || '').toLowerCase().includes(globalSearch) || (accounts.find(a=>a.id==t.account)?.name || '').toLowerCase().includes(globalSearch);
        return matchGlobal;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    document.getElementById('full-tx-body').innerHTML = filtered.map(t => {
        const accName = accounts.find(a => a.id == t.account)?.name || t.account;
        const typeClass = t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-slate-800 dark:text-white' : 'text-brand-600';
        const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '↔';
        return `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-dark-border/30 transition">
            <td class="px-4 md:px-6 py-3 md:py-4"><div class="flex items-center gap-2 md:gap-3"><div class="w-7 h-7 md:w-9 md:h-9 rounded-xl md:rounded-2xl bg-white/60 dark:bg-dark-surface flex items-center justify-center"><i class="fa-solid ${CATEGORY_ICONS[t.category] || 'fa-tag'} text-slate-500 text-xs md:text-base"></i></div><div><p class="font-bold text-xs md:text-sm text-slate-800 dark:text-slate-300">${t.desc || t.category || 'Transfer'}</p><p class="text-[8px] md:text-[9px] text-slate-400 uppercase">${t.date}</p></div></div></td>
            <td class="px-4 md:px-6 py-3 md:py-4"><span class="px-1.5 md:px-2 py-0.5 md:py-1 rounded-xl text-[8px] md:text-[9px] font-black uppercase bg-slate-200/50 dark:bg-dark-surface text-slate-600 dark:text-slate-400">${t.category || 'Transfer'}</span></td>
            <td class="px-4 md:px-6 py-3 md:py-4"><span class="text-[10px] md:text-xs font-semibold"><i class="fa-regular fa-building mr-1 text-slate-400"></i>${accName}${t.toAccount ? ' → ' + (accounts.find(a=>a.id==t.toAccount)?.name || t.toAccount) : ''}</span></td>
            <td class="px-4 md:px-6 py-3 md:py-4 text-right font-black text-xs md:text-sm whitespace-nowrap ${typeClass}">${sign} ${formatIDR(t.amount)}</td>
            <td class="px-4 md:px-6 py-3 md:py-4 text-center">
                <button onclick="editTx(${t.id})" class="w-6 h-6 inline-flex items-center justify-center text-slate-400 hover:text-brand-500"><i class="fa-regular fa-pen-to-square text-xs"></i></button>
                <button onclick="deleteTx(${t.id})" class="w-6 h-6 inline-flex items-center justify-center text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </td>
        </tr>`;
    }).join('');
    if (filtered.length === 0) document.getElementById('full-tx-body').innerHTML = '<tr><td colspan="5" class="p-6 md:p-10 text-center text-slate-400 text-xs md:text-sm">Tidak ada transaksi</td></tr>';
}

function renderDebts() {
    const container = document.getElementById('debt-list');
    if (!container) return;
    const today = new Date().toISOString().split('T')[0];
    debts.sort((a,b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
    container.innerHTML = debts.map(d => {
        const isOverdue = d.dueDate && d.dueDate < today && d.status !== 'paid';
        const statusClass = d.status === 'paid' ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-amber-600';
        const statusText = d.status === 'paid' ? 'Lunas' : isOverdue ? 'Terlewat' : 'Belum';
        return `
        <div class="glass bg-white/40 dark:bg-dark-surface/40 p-4 rounded-2xl border border-slate-200/30 dark:border-dark-border/50 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-sm md:text-base text-slate-700 dark:text-slate-300">${d.name}</h4>
                    <p class="text-[10px] md:text-xs text-slate-400 mt-1">${d.date} ${d.dueDate ? '· Jatuh tempo ' + d.dueDate : ''}</p>
                </div>
                <div class="flex gap-1">
                    <button onclick="toggleDebtStatus(${d.id})" class="text-slate-400 hover:text-brand-500"><i class="fa-regular fa-circle-check"></i></button>
                    <button onclick="deleteDebt(${d.id})" class="text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            </div>
            <p class="text-xs md:text-sm font-bold mt-2 ${d.type === 'lend' ? 'text-emerald-600' : 'text-rose-600'}">${d.type === 'lend' ? 'Piutang' : 'Utang'} ${formatIDR(d.amount)}</p>
            <p class="text-[9px] md:text-xs text-slate-400 mt-1">${d.desc || ''} · <span class="${statusClass}">${statusText}</span></p>
        </div>`;
    }).join('');
    if (debts.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs md:text-sm">Belum ada catatan utang/piutang</div>';
}

function openDebtModal(debt = null) {
    document.getElementById('debt-modal').classList.remove('hidden');
    document.getElementById('debt-modal').classList.add('flex');
    if (debt) {
        document.getElementById('debt-id').value = debt.id;
        document.getElementById('debt-type').value = debt.type;
        document.getElementById('debt-name').value = debt.name;
        document.getElementById('debt-amount').value = debt.amount;
        document.getElementById('debt-date').value = debt.date;
        document.getElementById('debt-due').value = debt.dueDate || '';
        document.getElementById('debt-desc').value = debt.desc || '';
    } else {
        document.getElementById('debt-id').value = '';
        document.getElementById('debt-name').value = '';
        document.getElementById('debt-amount').value = '';
        document.getElementById('debt-date').valueAsDate = new Date();
        document.getElementById('debt-due').value = '';
        document.getElementById('debt-desc').value = '';
    }
}

function closeDebtModal() {
    document.getElementById('debt-modal').classList.add('hidden');
    document.getElementById('debt-modal').classList.remove('flex');
}

function saveDebt(e) {
    e.preventDefault();
    const id = document.getElementById('debt-id').value;
    const type = document.getElementById('debt-type').value;
    const name = document.getElementById('debt-name').value.trim();
    const amount = parseFloat(document.getElementById('debt-amount').value);
    const date = document.getElementById('debt-date').value;
    const dueDate = document.getElementById('debt-due').value || null;
    const desc = document.getElementById('debt-desc').value.trim();
    if (!name || !amount) return;
    const debtData = { type, name, amount, date, dueDate, desc, status: 'pending' };
    if (id) {
        const index = debts.findIndex(d => d.id == id);
        if (index !== -1) debts[index] = { ...debts[index], ...debtData };
    } else {
        debts.push({ id: Date.now(), ...debtData });
    }
    localStorage.setItem('finvault_debts', JSON.stringify(debts));
    closeDebtModal();
    renderDebts();
    showToast('Catatan disimpan');
}

function deleteDebt(id) {
    if (confirm('Hapus catatan ini?')) {
        debts = debts.filter(d => d.id != id);
        localStorage.setItem('finvault_debts', JSON.stringify(debts));
        renderDebts();
        showToast('Dihapus');
    }
}

function toggleDebtStatus(id) {
    const debt = debts.find(d => d.id == id);
    if (debt) {
        debt.status = debt.status === 'paid' ? 'pending' : 'paid';
        localStorage.setItem('finvault_debts', JSON.stringify(debts));
        renderDebts();
        showToast(debt.status === 'paid' ? 'Ditandai lunas' : 'Ditandai belum lunas');
    }
}

function renderReminders() {
    const container = document.getElementById('reminder-list');
    if (!container) return;
    const today = new Date().toISOString().split('T')[0];
    reminders.sort((a, b) => a.date.localeCompare(b.date));
    container.innerHTML = reminders.map(r => {
        const overdue = r.date < today ? 'text-rose-600' : '';
        return `
        <div class="glass bg-white/40 dark:bg-dark-surface/40 p-4 rounded-2xl border border-slate-200/30 dark:border-dark-border/50 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-sm md:text-base text-slate-700 dark:text-slate-300">${r.title}</h4>
                    <p class="text-[10px] md:text-xs text-slate-400 mt-1">${r.date} ${overdue ? '(Terlewat)' : ''}</p>
                </div>
                <button onclick="deleteReminder(${r.id})" class="text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>
            ${r.amount ? `<p class="text-xs md:text-sm font-bold mt-2">${formatIDR(r.amount)}</p>` : ''}
            ${r.desc ? `<p class="text-[9px] md:text-xs text-slate-400 mt-1">${r.desc}</p>` : ''}
        </div>`;
    }).join('');
    if (reminders.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs md:text-sm">Belum ada pengingat</div>';
}

function saveReminder(e) {
    e.preventDefault();
    reminders.push({
        id: Date.now(),
        title: document.getElementById('reminder-title').value,
        amount: parseFloat(document.getElementById('reminder-amount').value) || null,
        date: document.getElementById('reminder-date').value,
        desc: document.getElementById('reminder-desc').value
    });
    localStorage.setItem('finvault_reminders', JSON.stringify(reminders));
    renderReminders();
    closeReminderModal();
    if (settings.notification && Notification.permission === 'granted') {
        new Notification('Pengingat ditambahkan', { body: document.getElementById('reminder-title').value });
    }
    showToast('Pengingat ditambahkan');
}

function deleteReminder(id) {
    reminders = reminders.filter(r => r.id !== id);
    localStorage.setItem('finvault_reminders', JSON.stringify(reminders));
    renderReminders();
    showToast('Pengingat dihapus');
}

function openReminderModal() { document.getElementById('reminder-modal').classList.remove('hidden'); document.getElementById('reminder-modal').classList.add('flex'); }
function closeReminderModal() { document.getElementById('reminder-modal').classList.add('hidden'); document.getElementById('reminder-modal').classList.remove('flex'); }

function renderGoals() {
    const container = document.getElementById('goal-list');
    if (!container) return;
    container.innerHTML = goals.map(g => {
        const progress = (g.current / g.target) * 100;
        const deadline = g.deadline ? new Date(g.deadline).toLocaleDateString('id-ID') : 'Tanpa batas';
        return `
        <div class="glass bg-white/40 dark:bg-dark-surface/40 p-4 rounded-2xl border border-slate-200/30 dark:border-dark-border/50 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <h4 class="font-bold text-sm md:text-base text-slate-700 dark:text-slate-300">${g.name}</h4>
                <button onclick="deleteGoal(${g.id})" class="text-slate-400 hover:text-rose-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
            </div>
            <div class="mt-2">
                <div class="flex justify-between text-[9px] md:text-xs font-bold text-slate-400">
                    <span>${formatIDR(g.current)}</span>
                    <span>${formatIDR(g.target)}</span>
                </div>
                <div class="h-1.5 w-full bg-slate-200/60 dark:bg-dark-border rounded-full overflow-hidden mt-1">
                    <div class="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style="width:${progress}%"></div>
                </div>
                <p class="text-[8px] md:text-[9px] text-slate-400 mt-2">Target: ${deadline}</p>
            </div>
        </div>`;
    }).join('');
    if (goals.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs md:text-sm">Belum ada target</div>';
}

function openGoalModal(goal = null) {
    document.getElementById('goal-modal').classList.remove('hidden');
    document.getElementById('goal-modal').classList.add('flex');
    if (goal) {
        document.getElementById('goal-id').value = goal.id;
        document.getElementById('goal-name').value = goal.name;
        document.getElementById('goal-target').value = goal.target;
        document.getElementById('goal-current').value = goal.current;
        document.getElementById('goal-deadline').value = goal.deadline || '';
    } else {
        document.getElementById('goal-id').value = '';
        document.getElementById('goal-name').value = '';
        document.getElementById('goal-target').value = '';
        document.getElementById('goal-current').value = '0';
        document.getElementById('goal-deadline').value = '';
    }
}

function closeGoalModal() { document.getElementById('goal-modal').classList.add('hidden'); document.getElementById('goal-modal').classList.remove('flex'); }

function saveGoal(e) {
    e.preventDefault();
    const id = document.getElementById('goal-id').value;
    const name = document.getElementById('goal-name').value;
    const target = parseFloat(document.getElementById('goal-target').value);
    const current = parseFloat(document.getElementById('goal-current').value) || 0;
    const deadline = document.getElementById('goal-deadline').value || null;
    const goalData = { name, target, current, deadline };
    if (id) {
        const idx = goals.findIndex(g => g.id == id);
        if (idx !== -1) goals[idx] = { ...goals[idx], ...goalData };
    } else {
        goals.push({ id: Date.now(), ...goalData });
    }
    localStorage.setItem('finvault_goals', JSON.stringify(goals));
    closeGoalModal();
    renderGoals();
    showToast('Target disimpan');
}

function deleteGoal(id) {
    if (confirm('Hapus target ini?')) {
        goals = goals.filter(g => g.id != id);
        localStorage.setItem('finvault_goals', JSON.stringify(goals));
        renderGoals();
        showToast('Target dihapus');
    }
}

function downloadCSV() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const saldo = inc - exp;
    let csv = 'LAPORAN KEUANGAN BULANAN\n';
    csv += `Periode:,${formatMonthIndo(filter)}\n`;
    csv += `Total Pemasukan:,${formatIDR(inc).replace(/Rp/g, '').trim()}\n`;
    csv += `Total Pengeluaran:,${formatIDR(exp).replace(/Rp/g, '').trim()}\n`;
    csv += `Saldo Bersih:,${formatIDR(saldo).replace(/Rp/g, '').trim()}\n\n`;
    csv += 'Tanggal,Tipe,Kategori,Akun,Deskripsi,Nominal (IDR)\n';
    filtered.forEach(t => {
        const tipe = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
        const nominal = t.type === 'income' ? t.amount : -t.amount;
        const akun = accounts.find(a => a.id == t.account)?.name || t.account;
        const akunTujuan = t.toAccount ? ' → ' + (accounts.find(a => a.id == t.toAccount)?.name || t.toAccount) : '';
        csv += `${formatDateIndo(t.date)},${tipe},${t.category || 'Transfer'},${akun}${akunTujuan},"${t.desc || ''}",${nominal}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LapKeuangan_${filter}.csv`;
    a.click();
    showToast('CSV diekspor');
}

function downloadPDF() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const saldo = inc - exp;
    const doc = new jspdf.jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN KEUANGAN', 105, 20, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    let y = 35;
    doc.text('Periode:', 20, y);
    doc.text(formatMonthIndo(filter), 70, y);
    y += 7;
    doc.text('Total Pemasukan:', 20, y);
    doc.text(formatIDR(inc), 70, y);
    y += 7;
    doc.text('Total Pengeluaran:', 20, y);
    doc.text(formatIDR(exp), 70, y);
    y += 7;
    doc.text('Saldo Bersih:', 20, y);
    doc.text(formatIDR(saldo), 70, y);
    y += 10;
    doc.autoTable({
        head: [['Tanggal', 'Tipe', 'Kategori', 'Akun', 'Deskripsi', 'Nominal']],
        body: filtered.map(t => [
            formatDateIndo(t.date),
            t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer',
            t.category || 'Transfer',
            (accounts.find(a => a.id == t.account)?.name || t.account) + (t.toAccount ? ' → ' + (accounts.find(a=>a.id==t.toAccount)?.name || t.toAccount) : ''),
            t.desc || '-',
            formatIDR(t.amount)
        ]),
        startY: y,
        styles: { fontSize: 8, lineHeight: 1.15 },
        headStyles: { fillColor: [99, 102, 241] }
    });
    doc.save(`LapKeuangan_${filter}.pdf`);
    showToast('PDF diekspor');
}

function openSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('settings-modal').classList.add('flex');
    document.getElementById('setting-notification').checked = settings.notification;
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
    document.getElementById('settings-modal').classList.remove('flex');
}

function saveSettings() {
    settings.notification = document.getElementById('setting-notification').checked;
    localStorage.setItem('finvault_settings', JSON.stringify(settings));
    if (settings.notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    closeSettingsModal();
    showToast('Pengaturan disimpan');
}

function backupData() {
    const data = { transactions, accounts, categories, budgets, debts, reminders, goals, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finvault_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    showToast('Backup berhasil');
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            transactions = data.transactions || [];
            accounts = data.accounts || [];
            categories = data.categories || { expense: defaultExpenseCategories, income: defaultIncomeCategories };
            budgets = data.budgets || {};
            debts = data.debts || [];
            reminders = data.reminders || [];
            goals = data.goals || [];
            settings = data.settings || { notification: false };
            localStorage.setItem('finvault_tx', JSON.stringify(transactions));
            localStorage.setItem('finvault_accounts', JSON.stringify(accounts));
            localStorage.setItem('finvault_categories', JSON.stringify(categories));
            localStorage.setItem('finvault_budgets', JSON.stringify(budgets));
            localStorage.setItem('finvault_debts', JSON.stringify(debts));
            localStorage.setItem('finvault_reminders', JSON.stringify(reminders));
            localStorage.setItem('finvault_goals', JSON.stringify(goals));
            localStorage.setItem('finvault_settings', JSON.stringify(settings));
            migrateData();
            refreshAll();
            renderAccounts();
            renderCategories();
            populateAccountSelects();
            showToast('Restore berhasil');
        } catch (err) {
            alert('File tidak valid');
        }
    };
    reader.readAsText(file);
}

function switchTab(tabId) {
    const tabs = ['dashboard','transactions','accounts','categories','budget','debts','reminders','goals'];
    tabs.forEach(t => {
        const view = document.getElementById(`view-${t}`);
        if (view) view.classList.add('hidden');
        const btn = document.getElementById(`nav-${t}`);
        if (btn) btn.className = "nav-item w-full flex items-center px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-border/50 font-medium transition-all gap-4";
    });
    const newView = document.getElementById(`view-${tabId}`);
    if (newView) newView.classList.remove('hidden');
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.className = "nav-item-active nav-item w-full flex items-center px-4 py-3 rounded-2xl text-brand-600 dark:text-brand-400 font-semibold transition-all gap-4";
    const titles = {
        dashboard:'Ringkasan', transactions:'Transaksi', accounts:'Akun', categories:'Kategori',
        budget:'Anggaran', debts:'Utang/Piutang', reminders:'Pengingat', goals:'Target'
    };
    document.getElementById('header-title').innerText = titles[tabId];
    
    if (tabId === 'transactions') {
        renderFullTransactions();
        populateAccountSelects();
    }
    if (tabId === 'accounts') renderAccounts();
    if (tabId === 'categories') renderCategories();
    if (tabId === 'budget') renderBudgetSettings();
    if (tabId === 'debts') renderDebts();
    if (tabId === 'reminders') renderReminders();
    if (tabId === 'goals') renderGoals();
    if (window.innerWidth < 1024) closeSidebar();
}

function renderBudgetSettings() {
    const container = document.getElementById('budget-input-list');
    container.innerHTML = (categories.expense || []).map(cat => `
        <div class="flex items-center gap-2 md:gap-3 bg-white/50 dark:bg-dark-surface/50 p-3 md:p-4 rounded-2xl md:rounded-3xl">
            <div class="w-7 h-7 md:w-9 md:h-9 rounded-xl md:rounded-2xl bg-white dark:bg-dark-surface flex items-center justify-center text-slate-400 shadow-sm text-xs md:text-base"><i class="fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}"></i></div>
            <div class="flex-1"><p class="text-[9px] md:text-xs font-bold text-slate-500 mb-1">${cat}</p><div class="relative"><span class="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] md:text-xs">Rp</span><input type="number" name="budget-${cat}" value="${budgets[cat] || ''}" placeholder="Batas" class="w-full pl-4 md:pl-5 bg-transparent border-none p-0 focus:ring-0 text-xs md:text-sm font-black outline-none text-slate-800 dark:text-slate-300"></div></div>
        </div>`).join('');
}

function saveBudgets(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    (categories.expense || []).forEach(cat => { budgets[cat] = parseFloat(formData.get(`budget-${cat}`)) || 0; });
    localStorage.setItem('finvault_budgets', JSON.stringify(budgets));
    refreshAll();
    switchTab('dashboard');
    showToast('Anggaran diperbarui');
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    migrateData();
    const today = new Date();
    const yearMonth = today.toISOString().slice(0, 7);
    document.getElementById('date-filter').value = yearMonth;
    updateDateLabel();
    setFormType('expense');
    updateGreeting();
    if (isSidebarCollapsed && window.innerWidth >= 1024) {
        document.getElementById('sidebar').classList.add('sidebar-collapsed');
        document.getElementById('main-content').style.marginLeft = '5rem';
        document.getElementById('collapse-icon').classList.replace('fa-chevron-left', 'fa-chevron-right');
    }
    document.getElementById('current-year').innerText = new Date().getFullYear();
    
    populateAccountSelects();
    populateCategorySelects();
    refreshAll();

    document.getElementById('f-recurring').addEventListener('change', (e) => {
        document.getElementById('recurring-options').classList.toggle('hidden', !e.target.checked);
    });

    const searchInput = document.getElementById('tx-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => renderFullTransactions(), 300);
        });
    }

    if (settings.notification && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobile-overlay').classList.add('hidden');
        document.getElementById('main-content').style.marginLeft = '0';
    } else {
        document.getElementById('main-content').style.marginLeft = isSidebarCollapsed ? '5rem' : '18rem';
    }
}, { passive: true });
