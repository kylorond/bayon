const CATEGORIES = {
    expense: ['Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Investasi', 'Lainnya'],
    income: ['Gaji', 'Bonus', 'Freelance', 'Hadiah', 'Bunga Bank', 'Lainnya']
};
const CATEGORY_ICONS = {
    'Makan & Minum':'fa-utensils','Transportasi':'fa-car','Belanja':'fa-bag-shopping','Tagihan':'fa-bolt','Hiburan':'fa-gamepad','Kesehatan':'fa-heart-pulse',
    'Pendidikan':'fa-graduation-cap','Investasi':'fa-chart-line','Lainnya':'fa-ellipsis','Gaji':'fa-money-bill-wave','Bonus':'fa-certificate',
    'Freelance':'fa-laptop-code','Hadiah':'fa-gift','Bunga Bank':'fa-building-columns'
};

let transactions = JSON.parse(localStorage.getItem('finvault_tx')) || [];
let budgets = JSON.parse(localStorage.getItem('finvault_budgets')) || {};
let mainChart = null, donutChart = null;
let isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

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
    const titles = { dashboard:'Ringkasan Eksekutif', transactions:'Jurnal Transaksi', budget:'Manajemen Anggaran' };
    document.getElementById('header-title').innerText = titles[tabId];
    if(tabId==='transactions') renderFullTransactions();
    if(tabId==='budget') renderBudgetSettings();
    if(window.innerWidth<1024) closeSidebar();
}

function refreshAll() {
    const filter = document.getElementById('date-filter').value;
    const filtered = transactions.filter(t => t.date.startsWith(filter));
    const inc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    document.getElementById('stat-income').innerText = formatIDR(inc);
    document.getElementById('stat-expense').innerText = formatIDR(exp);
    document.getElementById('stat-savings').innerText = formatIDR(inc - exp);
    const totalSaldo = transactions.reduce((s,t)=> t.type==='income' ? s+t.amount : s-t.amount,0);
    document.getElementById('sidebar-balance').innerText = formatIDR(totalSaldo);
    renderDashboardList(filtered);
    renderBudgets(filtered);
    updateCharts(filtered);
}

function renderDashboardList(data) {
    const list = document.getElementById('dashboard-tx-list');
    list.innerHTML = data.slice(0,5).map(t => `<tr class="group hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition">
        <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i class="fa-solid ${CATEGORY_ICONS[t.category]||'fa-tag'}"></i></div><div><p class="font-bold text-sm">${t.desc||t.category}</p><p class="text-[9px] text-slate-400 font-bold uppercase">${t.date}</p></div></div></td>
        <td class="px-6 py-4 text-right font-black ${t.type==='income'?'text-emerald-500':'text-slate-900 dark:text-white'}">${t.type==='income'?'+':'-'} ${formatIDR(t.amount)}</td></tr>`).join('');
    if(data.length===0) list.innerHTML = '<tr><td colspan="2" class="p-10 text-center text-slate-400">Belum ada transaksi</td></tr>';
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
            html += `<div><div class="flex justify-between text-xs font-bold mb-1"><span>${cat}</span><span class="${perc>=90?'text-rose-500':'text-slate-400'}">${perc.toFixed(0)}%</span></div>
            <div class="h-2 w-full bg-slate-200/60 dark:bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style="width:${perc}%"></div></div>
            <div class="flex justify-between text-[9px] font-bold text-slate-400 mt-1"><span>${formatIDR(spent)}</span><span>${formatIDR(limit)}</span></div></div>`;
        }
    });
    container.innerHTML = html || '<div class="text-center p-6 text-slate-400">Belum ada anggaran diatur.</div>';
    document.getElementById('budget-percentage').innerText = totalLimit>0 ? (totalSpent/totalLimit*100).toFixed(0)+'%' : '0%';
}

function renderBudgetSettings() {
    const container = document.getElementById('budget-input-list');
    container.innerHTML = CATEGORIES.expense.map(cat => `
        <div class="flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl">
            <div class="w-9 h-9 rounded-xl bg-white dark:bg-dark-surface flex items-center justify-center text-slate-400 shadow-sm"><i class="fa-solid ${CATEGORY_ICONS[cat]}"></i></div>
            <div class="flex-1"><p class="text-xs font-bold text-slate-500 mb-1">${cat}</p><div class="relative"><span class="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span><input type="number" name="budget-${cat}" value="${budgets[cat]||''}" placeholder="Batas" class="w-full pl-5 bg-transparent border-none p-0 focus:ring-0 text-sm font-black outline-none"></div></div>
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
        <div class="flex justify-between items-center text-xs font-medium"><div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:${donutChart.data.datasets[0].backgroundColor[i]}"></div><span>${cat}</span></div><span class="font-bold">${formatIDR(val)}</span></div>
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
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ y:{display:false}, x:{grid:{display:false}, ticks:{font:{size:9}}}} }
    });
}

function renderFullTransactions() {
    const search = document.getElementById('tx-search').value.toLowerCase();
    const type = document.getElementById('tx-type-filter').value;
    const filtered = transactions.filter(t => (t.desc||'').toLowerCase().includes(search)||t.category.toLowerCase().includes(search) && (type==='all'||t.type===type));
    document.getElementById('full-tx-body').innerHTML = filtered.map(t => `
        <tr class="hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition">
            <td class="px-6 py-4"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl bg-white/60 dark:bg-dark-surface flex items-center justify-center"><i class="fa-solid ${CATEGORY_ICONS[t.category]||'fa-tag'} text-slate-500"></i></div><div><p class="font-bold text-sm">${t.desc||'—'}</p><p class="text-[9px] text-slate-400 uppercase">${t.date}</p></div></div></td>
            <td class="px-6 py-4"><span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${t.category}</span></td>
            <td class="px-6 py-4"><span class="text-xs font-semibold"><i class="fa-regular fa-building mr-1"></i>${t.account}</span></td>
            <td class="px-6 py-4 text-right font-black text-sm ${t.type==='income'?'text-emerald-500':'text-slate-900 dark:text-white'}">${t.type==='income'?'+':'-'} ${formatIDR(t.amount)}</td>
            <td class="px-6 py-4 text-center"><button onclick="deleteTx(${t.id})" class="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-500/10 transition-all"><i class="fa-solid fa-trash-can text-xs"></i></button></td>
        </tr>`).join('');
}

function handleSubmit(e) {
    e.preventDefault();
    const newTx = {
        id: Date.now(), type: document.getElementById('f-type').value, amount: parseFloat(document.getElementById('f-amount').value),
        date: document.getElementById('f-date').value, account: document.getElementById('f-account').value,
        category: document.getElementById('f-category').value, desc: document.getElementById('f-desc').value
    };
    transactions.unshift(newTx);
    localStorage.setItem('finvault_tx', JSON.stringify(transactions));
    refreshAll(); closeModal(); e.target.reset(); setFormType('expense');
}

function deleteTx(id) { if(confirm('Hapus transaksi ini?')) { transactions = transactions.filter(t=>t.id!==id); localStorage.setItem('finvault_tx',JSON.stringify(transactions)); refreshAll(); renderFullTransactions(); } }

function downloadCSV() {
    let csv = 'Tanggal,Tipe,Kategori,Akun,Deskripsi,Nominal\n';
    transactions.forEach(t => csv += `${t.date},${t.type},${t.category},${t.account},"${t.desc||''}",${t.amount}\n`);
    const blob = new Blob([csv],{type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FinVault-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function setFormType(type) {
    document.getElementById('f-type').value = type;
    document.getElementById('type-exp').className = type==='expense'?'py-3 rounded-xl text-sm font-bold bg-white dark:bg-dark-surface text-rose-500 shadow-sm transition-all':'py-3 rounded-xl text-sm font-bold text-slate-500 transition-all';
    document.getElementById('type-inc').className = type==='income'?'py-3 rounded-xl text-sm font-bold bg-white dark:bg-dark-surface text-emerald-500 shadow-sm transition-all':'py-3 rounded-xl text-sm font-bold text-slate-500 transition-all';
    const catSelect = document.getElementById('f-category');
    catSelect.innerHTML = CATEGORIES[type].map(c => `<option value="${c}">${c}</option>`).join('');
}

function openModal() { document.getElementById('tx-modal').classList.remove('hidden'); document.getElementById('tx-modal').classList.add('flex'); document.getElementById('f-date').valueAsDate = new Date(); }
function closeModal() { document.getElementById('tx-modal').classList.add('hidden'); document.getElementById('tx-modal').classList.remove('flex'); }

window.onload = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    document.getElementById('date-filter').value = new Date().toISOString().slice(0,7);
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