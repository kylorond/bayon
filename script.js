let transactions = JSON.parse(localStorage.getItem('finvault_tx')) || [];
let budgets = JSON.parse(localStorage.getItem('finvault_budgets')) || {};
let mainChart = null, donutChart = null;
let isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

const CATEGORIES = {
    expense: ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Investasi', 'Tarik Tunai', 'Lainnya'],
    income: ['Gaji', 'Bonus', 'Freelance', 'Hadiah', 'Bunga Bank', 'Lainnya']
};
const CATEGORY_ICONS = {
    'Makan & Minum':'fa-utensils','Transportasi':'fa-car','Belanja':'fa-bag-shopping','Tagihan':'fa-bolt','Hiburan':'fa-gamepad','Kesehatan':'fa-heart-pulse',
    'Pendidikan':'fa-graduation-cap','Investasi':'fa-chart-line','Tarik Tunai':'fa-hand-holding-dollar','Lainnya':'fa-ellipsis','Gaji':'fa-money-bill-wave','Bonus':'fa-certificate',
    'Freelance':'fa-laptop-code','Hadiah':'fa-gift','Bunga Bank':'fa-building-columns'
};

function formatIDR(num) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num); }

function toggleTheme() { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; }

function toggleSidebarCollapse() {
    if (window.innerWidth < 1024) return;
    isSidebarCollapsed = !isSidebarCollapsed;
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const icon = document.getElementById('collapse-icon');
    if (isSidebarCollapsed) {
        sidebar.classList.add('sidebar-collapsed');
        main.style.marginLeft = '5rem';
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        main.style.marginLeft = '18rem';
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
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

function switchTab(tabId) {
    ['dashboard','transactions','budget'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        const btn = document.getElementById(`nav-${t}`);
        if(btn) btn.className = "nav-item w-full flex items-center px-4 py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 font-medium transition-all gap-4";
    });
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if(activeBtn) activeBtn.className = "nav-item-active nav-item w-full flex items-center px-4 py-3 rounded-xl text-brand-600 dark:text-brand-400 font-semibold transition-all gap-4";
    const titles = { dashboard:'Ringkasan', transactions:'Transaksi', budget:'Anggaran' };
    document.getElementById('header-title').innerText = titles[tabId];
    if(tabId==='transactions') renderFullTransactions();
    if(tabId==='budget') renderBudgetSettings();
    if(window.innerWidth<1024) closeSidebar();
}

function calculateBalances() {
    const balanceMap = {};
    transactions.forEach(t => {
        const account = t.account || 'Cash';
        if (!balanceMap[account]) balanceMap[account] = 0;
        if (t.type === 'income') balanceMap[account] += t.amount;
        else balanceMap[account] -= t.amount;
    });
    return balanceMap;
}

function renderAccountBalances() {
    const balances = calculateBalances();
    const total = Object.values(balances).reduce((a,b) => a + b, 0);
    document.getElementById('sidebar-balance').innerText = formatIDR(total);
    const container = document.getElementById('account-balance-list');
    if (!container) return;
    const sorted = Object.entries(balances).sort((a,b) => b[1] - a[1]);
    container.innerHTML = sorted.map(([acc, bal]) => `
        <div class="glass bg-white/40 dark:bg-slate-800/40 p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200/30 dark:border-dark-border/50 flex items-center gap-2 md:gap-3 hover:shadow-md transition-shadow">
            <div class="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-brand-100/60 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 text-sm md:text-base">
                <i class="fa-solid ${acc.toLowerCase().includes('cash') ? 'fa-money-bill' : 'fa-building-columns'}"></i>
            </div>
            <div class="min-w-0 flex-1">
                <p class="text-[9px] md:text-xs font-bold text-slate-400 uppercase truncate">${acc}</p>
                <p class="text-sm md:text-base font-black break-words ${bal >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatIDR(bal)}</p>
            </div>
        </div>
    `).join('');
    if (sorted.length === 0) container.innerHTML = '<div class="col-span-full text-center text-slate-400 py-4 text-xs md:text-sm">Belum ada saldo akun</div>';
}

function updateDateLabel() {
    const input = document.getElementById('date-filter');
    const label = document.getElementById('date-label');
    if (input.value) {
        const [year, month] = input.value.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        label.innerText = `${monthNames[parseInt(month)-1]} ${year}`;
    } else {
        label.innerText = '';
    }
}

function refreshAll() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    document.getElementById('stat-income').innerText = formatIDR(inc);
    document.getElementById('stat-expense').innerText = formatIDR(exp);
    document.getElementById('stat-savings').innerText = formatIDR(inc - exp);
    document.getElementById('stat-count').innerText = filtered.length;
    renderAccountBalances();
    renderDashboardList(filtered);
    renderBudgets(filtered);
    updateCharts(filtered);
}

function renderDashboardList(data) {
    const list = document.getElementById('dashboard-tx-list');
    list.innerHTML = data.slice(0,5).map(t => `<tr class="group hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition">
        <td class="px-4 md:px-6 py-3 md:py-4"><div class="flex items-center gap-2 md:gap-3"><div class="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-xs md:text-base"><i class="fa-solid ${CATEGORY_ICONS[t.category]||'fa-tag'}"></i></div><div><p class="font-bold text-xs md:text-sm">${t.desc||t.category}</p><p class="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase">${t.date}</p></div></div></td>
        <td class="px-4 md:px-6 py-3 md:py-4 text-right font-black text-xs md:text-sm whitespace-nowrap ${t.type==='income'?'text-emerald-500':'text-slate-900 dark:text-white'}">${t.type==='income'?'+':'-'} ${formatIDR(t.amount)}</td></tr>`).join('');
    if(data.length===0) list.innerHTML = '<tr><td colspan="2" class="p-6 md:p-10 text-center text-slate-400 text-xs md:text-sm">Belum ada transaksi</td></tr>';
}

function renderBudgets(data) {
    const container = document.getElementById('budget-progress-list');
    const expByCat = {}; data.filter(t=>t.type==='expense').forEach(t=> expByCat[t.category] = (expByCat[t.category]||0)+t.amount);
    let html = '', totalLimit=0, totalSpent=0;
    CATEGORIES.expense.forEach(cat => {
        const limit = budgets[cat]||0;
        if(limit>0) {
            const spent = expByCat[cat]||0; const perc = Math.min((spent/limit)*100,100);
            totalLimit+=limit; totalSpent+=spent;
            html += `<div><div class="flex justify-between text-[10px] md:text-xs font-bold mb-1"><span>${cat}</span><span class="${perc>=90?'text-rose-500':'text-slate-400'}">${perc.toFixed(0)}%</span></div>
            <div class="h-1.5 md:h-2 w-full bg-slate-200/60 dark:bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style="width:${perc}%"></div></div>
            <div class="flex justify-between text-[8px] md:text-[9px] font-bold text-slate-400 mt-1"><span>${formatIDR(spent)}</span><span>${formatIDR(limit)}</span></div></div>`;
        }
    });
    container.innerHTML = html || '<div class="text-center p-4 md:p-6 text-slate-400 text-xs md:text-sm">Belum ada anggaran diatur.</div>';
    document.getElementById('budget-percentage').innerText = totalLimit>0 ? (totalSpent/totalLimit*100).toFixed(0)+'%' : '0%';
}

function renderBudgetSettings() {
    const container = document.getElementById('budget-input-list');
    container.innerHTML = CATEGORIES.expense.map(cat => `
        <div class="flex items-center gap-2 md:gap-3 bg-white/50 dark:bg-slate-800/50 p-3 md:p-4 rounded-xl md:rounded-2xl">
            <div class="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-dark-surface flex items-center justify-center text-slate-400 shadow-sm text-xs md:text-base"><i class="fa-solid ${CATEGORY_ICONS[cat]}"></i></div>
            <div class="flex-1"><p class="text-[9px] md:text-xs font-bold text-slate-500 mb-1">${cat}</p><div class="relative"><span class="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] md:text-xs">Rp</span><input type="number" name="budget-${cat}" value="${budgets[cat]||''}" placeholder="Batas" class="w-full pl-4 md:pl-5 bg-transparent border-none p-0 focus:ring-0 text-xs md:text-sm font-black outline-none"></div></div>
        </div>`).join('');
}

function saveBudgets(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    CATEGORIES.expense.forEach(cat => { budgets[cat] = parseFloat(formData.get(`budget-${cat}`))||0; });
    localStorage.setItem('finvault_budgets', JSON.stringify(budgets));
    refreshAll(); switchTab('dashboard');
}

function updateCharts(data) {
    const expByCat = {}; data.filter(t=>t.type==='expense').forEach(t=> expByCat[t.category] = (expByCat[t.category]||0)+t.amount);
    const donutCtx = document.getElementById('donutChart').getContext('2d');
    if(donutChart) donutChart.destroy();
    donutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(expByCat),
            datasets: [{
                data: Object.values(expByCat),
                backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316'],
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9' } } }
    });
    const legend = document.getElementById('chart-legend');
    legend.innerHTML = Object.entries(expByCat).slice(0,5).map(([cat,val],i)=>`
        <div class="flex justify-between items-center text-[10px] md:text-xs font-medium"><div class="flex items-center gap-1 md:gap-2"><div class="w-2 h-2 md:w-3 md:h-3 rounded-full" style="background:${donutChart.data.datasets[0].backgroundColor[i]}"></div><span>${cat}</span></div><span class="font-bold">${formatIDR(val)}</span></div>
    `).join('');

    const days = Array.from({length:31},(_,i)=>(i+1).toString().padStart(2,'0'));
    const dailyInc = new Array(31).fill(0), dailyExp = new Array(31).fill(0);
    data.forEach(t => { let d = parseInt(t.date.split('-')[2])-1; if(t.type==='income') dailyInc[d]+=t.amount; else dailyExp[d]+=t.amount; });
    const mainCtx = document.getElementById('mainChart').getContext('2d');
    if(mainChart) mainChart.destroy();
    mainChart = new Chart(mainCtx, {
        type: 'line',
        data: { labels: days, datasets: [
            { label:'Masuk', data:dailyInc, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.02)', tension:0.3, fill:true, borderWidth:2, pointRadius:0 },
            { label:'Keluar', data:dailyExp, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.02)', tension:0.3, fill:true, borderWidth:2, pointRadius:0 }
        ] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ y:{display:false}, x:{grid:{display:false}, ticks:{font:{size:8}}}} }
    });
}

function renderFullTransactions() {
    const globalSearch = document.getElementById('tx-search').value.toLowerCase();
    const typeFilter = document.getElementById('tx-type-filter').value;
    const filtered = transactions.filter(t => {
        const matchGlobal = (t.desc||'').toLowerCase().includes(globalSearch) || t.category.toLowerCase().includes(globalSearch) || (t.account||'').toLowerCase().includes(globalSearch);
        const matchType = typeFilter === 'all' || t.type === typeFilter;
        return matchGlobal && matchType;
    });
    document.getElementById('full-tx-body').innerHTML = filtered.map(t => `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition">
            <td class="px-4 md:px-6 py-3 md:py-4"><div class="flex items-center gap-2 md:gap-3"><div class="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white/60 dark:bg-dark-surface flex items-center justify-center"><i class="fa-solid ${CATEGORY_ICONS[t.category]||'fa-tag'} text-slate-500 text-xs md:text-base"></i></div><div><p class="font-bold text-xs md:text-sm">${t.desc||'—'}</p><p class="text-[8px] md:text-[9px] text-slate-400 uppercase">${t.date}</p></div></div></td>
            <td class="px-4 md:px-6 py-3 md:py-4"><span class="px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${t.category}</span></td>
            <td class="px-4 md:px-6 py-3 md:py-4"><span class="text-[10px] md:text-xs font-semibold"><i class="fa-regular fa-building mr-1"></i>${t.account}</span></td>
            <td class="px-4 md:px-6 py-3 md:py-4 text-right font-black text-xs md:text-sm whitespace-nowrap ${t.type==='income'?'text-emerald-500':'text-slate-900 dark:text-white'}">${t.type==='income'?'+':'-'} ${formatIDR(t.amount)}</td>
            <td class="px-4 md:px-6 py-3 md:py-4 text-center"><button onclick="deleteTx(${t.id})" class="w-6 h-6 md:w-7 md:h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-500/10 transition-all"><i class="fa-solid fa-trash-can text-[10px] md:text-xs"></i></button></td>
        </tr>`).join('');
    if(filtered.length===0) document.getElementById('full-tx-body').innerHTML = '<tr><td colspan="5" class="p-6 md:p-10 text-center text-slate-400 text-xs md:text-sm">Tidak ada transaksi</td></tr>';
}

function handleSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('f-type').value;
    const amount = parseFloat(document.getElementById('f-amount').value);
    const date = document.getElementById('f-date').value;
    const account = document.getElementById('f-account').value;
    const category = document.getElementById('f-category').value;
    const desc = document.getElementById('f-desc').value;

    if (type === 'expense' && category === 'Tarik Tunai') {
        if (account === 'Cash') {
            alert('Tidak dapat melakukan tarik tunai dari akun Cash.');
            return;
        }
        const expenseTx = {
            id: Date.now(),
            type: 'expense',
            amount: amount,
            date: date,
            account: account,
            category: 'Tarik Tunai',
            desc: 'Tarik Tunai ke Cash'
        };
        const incomeTx = {
            id: Date.now() + 1,
            type: 'income',
            amount: amount,
            date: date,
            account: 'Cash',
            category: 'Tarik Tunai',
            desc: `Tarik Tunai dari ${account}`
        };
        transactions.unshift(expenseTx, incomeTx);
    } else {
        const newTx = {
            id: Date.now(),
            type: type,
            amount: amount,
            date: date,
            account: account,
            category: category,
            desc: desc
        };
        transactions.unshift(newTx);
    }

    localStorage.setItem('finvault_tx', JSON.stringify(transactions));
    refreshAll();
    if (!document.getElementById('view-transactions').classList.contains('hidden')) {
        renderFullTransactions();
    }
    closeModal();
    e.target.reset();
    setFormType('expense');
}

function deleteTx(id) {
    if (confirm('Hapus transaksi ini?')) {
        transactions = transactions.filter(t => t.id !== id);
        localStorage.setItem('finvault_tx', JSON.stringify(transactions));
        refreshAll();
        renderFullTransactions();
    }
}

function downloadCSV() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const saldo = inc - exp;
    let csv = 'LAPORAN KEUANGAN BULANAN\n';
    csv += `Periode,${filter}\n`;
    csv += `Total Pemasukan,${formatIDR(inc).replace(/Rp/g,'').trim()}\n`;
    csv += `Total Pengeluaran,${formatIDR(exp).replace(/Rp/g,'').trim()}\n`;
    csv += `Saldo Bersih,${formatIDR(saldo).replace(/Rp/g,'').trim()}\n\n`;
    csv += 'Tanggal,Tipe,Kategori,Akun,Deskripsi,Nominal (IDR)\n';
    filtered.forEach(t => {
        let nominal = t.type === 'income' ? t.amount : -t.amount;
        csv += `${t.date},${t.type},${t.category},${t.account},"${t.desc||''}",${nominal}\n`;
    });
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `LapKeuangan_${filter}.csv`;
    a.click();
}

function downloadPDF() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const saldo = inc - exp;

    const doc = new jspdf.jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Keuangan', 14, 20);
    doc.setFontSize(10);
    doc.text(`Periode: ${filter}`, 14, 30);
    doc.text(`Total Pemasukan: ${formatIDR(inc)}`, 14, 38);
    doc.text(`Total Pengeluaran: ${formatIDR(exp)}`, 14, 46);
    doc.text(`Saldo Bersih: ${formatIDR(saldo)}`, 14, 54);

    const tableData = filtered.map(t => [t.date, t.type, t.category, t.account, t.desc||'-', formatIDR(t.amount)]);
    doc.autoTable({
        head: [['Tanggal', 'Tipe', 'Kategori', 'Akun', 'Deskripsi', 'Nominal']],
        body: tableData,
        startY: 64,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }
    });
    doc.save(`LapKeuangan_${filter}.pdf`);
}

function setFormType(type) {
    document.getElementById('f-type').value = type;
    document.getElementById('type-exp').className = type==='expense'?'py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold bg-white dark:bg-dark-surface text-rose-500 shadow-sm transition-all':'py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-slate-500 transition-all';
    document.getElementById('type-inc').className = type==='income'?'py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold bg-white dark:bg-dark-surface text-emerald-500 shadow-sm transition-all':'py-2 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-slate-500 transition-all';
    const catSelect = document.getElementById('f-category');
    catSelect.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');
}

function openModal() { document.getElementById('tx-modal').classList.remove('hidden'); document.getElementById('tx-modal').classList.add('flex'); document.getElementById('f-date').valueAsDate = new Date(); }
function closeModal() { document.getElementById('tx-modal').classList.add('hidden'); document.getElementById('tx-modal').classList.remove('flex'); }

window.onload = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    const today = new Date();
    const yearMonth = today.toISOString().slice(0,7);
    document.getElementById('date-filter').value = yearMonth;
    updateDateLabel();
    setFormType('expense');
    if (isSidebarCollapsed && window.innerWidth >= 1024) {
        document.getElementById('sidebar').classList.add('sidebar-collapsed');
        document.getElementById('main-content').style.marginLeft = '5rem';
        document.getElementById('collapse-icon').classList.replace('fa-chevron-left','fa-chevron-right');
    }
    document.getElementById('current-year').innerText = new Date().getFullYear();
    refreshAll();
};

window.addEventListener('resize', function() {
    if (window.innerWidth < 1024) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobile-overlay').classList.add('hidden');
        document.getElementById('main-content').style.marginLeft = '0';
    } else {
        if (!isSidebarCollapsed) {
            document.getElementById('main-content').style.marginLeft = '18rem';
        } else {
            document.getElementById('main-content').style.marginLeft = '5rem';
        }
    }
});
