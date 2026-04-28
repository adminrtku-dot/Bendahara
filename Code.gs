function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Rekap Keuangan Gg. Mutiara II')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


const GAS_URL = 'https://script.google.com/macros/s/AKfycbw2ZtwWkKMxDpte4EnHYIlcx8Hf_wF6Kv59CCzuFXsrY5aNVXi1HGZJxJZb4HEF-dFn/exec'; // Ganti dengan URL Web App GAS untuk sync ke Google Sheet

const STORAGE_KEY = 'keuangan_data';
let keuanganData = [];

const kategoriMasuk = ['Gaji', 'Usaha', 'Lainnya'];
const kategoriKeluar = ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Lainnya'];

const $ = (id) => document.getElementById(id);
const saldoEl = $('saldo');
const totalMasukEl = $('totalMasuk');
const totalKeluarEl = $('totalKeluar');
const listEl = $('listTransaksi');
const emptyEl = $('emptyState');
const filterBulan = $('filterBulan');
const modal = $('modal');
const backdrop = $('backdrop');
const sheet = $('sheet');
const fab = $('fab');
const closeModalBtn = $('closeModal');
const form = $('formTransaksi');
const tanggalInput = $('tanggal');
const kategoriSelect = $('kategori');
const keteranganInput = $('keterangan');
const jumlahInput = $('jumlah');
const exportBtn = $('exportBtn');
const toast = $('toast');
const toastText = $('toastText');
const syncStatus = $('syncStatus');

function init() {
  loadData();
  setupEvents();
  setCurrentMonth();
  updateKategori();
  render();
  lucide.createIcons();
  if (GAS_URL) loadFromGAS();
}

function getInitialData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return [
    { id: '1', tanggal: `${y}-${m}-02`, tipe: 'masuk', kategori: 'Gaji', keterangan: 'Gaji bulanan', jumlah: 8500000 },
    { id: '2', tanggal: `${y}-${m}-03`, tipe: 'keluar', kategori: 'Tagihan', keterangan: 'Listrik & Internet', jumlah: 650000 },
    { id: '3', tanggal: `${y}-${m}-05`, tipe: 'keluar', kategori: 'Belanja', keterangan: 'Belanja bulanan', jumlah: 1250000 },
    { id: '4', tanggal: `${y}-${m}-10`, tipe: 'masuk', kategori: 'Usaha', keterangan: 'Jual online', jumlah: 1500000 },
    { id: '5', tanggal: `${y}-${m}-15`, tipe: 'keluar', kategori: 'Makan', keterangan: 'Makan siang kantor', jumlah: 75000 },
  ];
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { keuanganData = JSON.parse(saved); } catch { keuanganData = getInitialData(); }
  } else {
    keuanganData = getInitialData();
    saveData(false);
  }
}

function saveData(showToast = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keuanganData));
  if (showToast) showSyncStatus();
  if (GAS_URL) syncToGAS();
}

function setCurrentMonth() {
  const now = new Date();
  filterBulan.value = now.toISOString().slice(0, 7);
  tanggalInput.valueAsDate = now;
}

function setupEvents() {
  fab.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  filterBulan.addEventListener('change', render);
  exportBtn.addEventListener('click', exportPDF);
  form.addEventListener('submit', handleSubmit);
  
  document.querySelectorAll('input[name="tipe"]').forEach(r => {
    r.addEventListener('change', updateKategori);
  });

  jumlahInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val) e.target.value = formatRupiahInput(val);
    else e.target.value = '';
  });
}

function updateKategori() {
  const tipe = document.querySelector('input[name="tipe"]:checked').value;
  const list = tipe === 'masuk' ? kategoriMasuk : kategoriKeluar;
  kategoriSelect.innerHTML = list.map(k => `<option value="${k}">${k}</option>`).join('');
}

function openModal() {
  modal.classList.remove('hidden');
  setTimeout(() => {
    backdrop.classList.remove('opacity-0');
    sheet.classList.remove('translate-y-full');
  }, 10);
  tanggalInput.valueAsDate = new Date();
  form.reset();
  updateKategori();
  setTimeout(() => keteranganInput.focus(), 300);
}

function closeModal() {
  backdrop.classList.add('opacity-0');
  sheet.classList.add('translate-y-full');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

function handleSubmit(e) {
  e.preventDefault();
  const jumlah = parseInt(jumlahInput.value.replace(/\./g, '')) || 0;
  if (jumlah <= 0) return showToast('Jumlah harus lebih dari 0', true);

  const data = {
    id: Date.now().toString(),
    tanggal: tanggalInput.value,
    tipe: document.querySelector('input[name="tipe"]:checked').value,
    kategori: kategoriSelect.value,
    keterangan: keteranganInput.value.trim(),
    jumlah
  };

  keuanganData.unshift(data);
  saveData();
  render();
  closeModal();
  showToast('Transaksi berhasil ditambah');
}

function deleteTransaksi(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-20px)';
  }
  setTimeout(() => {
    keuanganData = keuanganData.filter(t => t.id !== id);
    saveData();
    render();
    showToast('Transaksi dihapus');
  }, 200);
}

function render() {
  const bulan = filterBulan.value;
  const filtered = keuanganData
    .filter(t => t.tanggal.startsWith(bulan))
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  const totalMasuk = filtered.filter(t => t.tipe === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = filtered.filter(t => t.tipe === 'keluar').reduce((s, t) => s + t.jumlah, 0);
  const saldo = totalMasuk - totalKeluar;

  saldoEl.textContent = formatRupiah(saldo);
  totalMasukEl.textContent = formatRupiah(totalMasuk);
  totalKeluarEl.textContent = formatRupiah(totalKeluar);

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    emptyEl.classList.add('flex');
  } else {
    emptyEl.classList.add('hidden');
    emptyEl.classList.remove('flex');
    listEl.innerHTML = filtered.map(t => {
      const isMasuk = t.tipe === 'masuk';
      const date = new Date(t.tanggal);
      const tgl = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      const icon = getKategoriIcon(t.kategori, isMasuk);
      const color = isMasuk ? 'emerald' : 'red';
      
      return `
        <div data-id="${t.id}" class="group bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-xl bg-${color}-50 flex items-center justify-center shrink-0">
              <i data-lucide="${icon}" class="w-5 h-5 text-${color}-600"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-medium text-[14px] text-gray-900 truncate">${t.keterangan}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[12px] text-gray-500">${tgl}</span>
                    <span class="text-[11px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600">${t.kategori}</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="font-semibold text-[15px] ${isMasuk ? 'text-emerald-600' : 'text-red-500'}">${isMasuk ? '+' : '-'} ${formatRupiah(t.jumlah)}</p>
                  <button onclick="deleteTransaksi('${t.id}')" class="mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1 ml-auto">
                    <i data-lucide="trash-2" class="w-3 h-3"></i> Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  setTimeout(() => lucide.createIcons(), 0);
}

function getKategoriIcon(kat, isMasuk) {
  const icons = {
    Gaji: 'briefcase', Usaha: 'store', Makan: 'utensils', Transport: 'car',
    Belanja: 'shopping-bag', Tagihan: 'receipt', Lainnya: 'circle-dollar-sign'
  };
  return icons[kat] || (isMasuk ? 'arrow-down-left' : 'arrow-up-right');
}

function formatRupiah(num) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(num);
}
function formatRupiahInput(angka) {
  return new Intl.NumberFormat('id-ID').format(angka);
}
function formatTanggalIndo(tgl) {
  return new Date(tgl).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showToast(msg, isError = false) {
  toastText.textContent = msg;
  toast.querySelector('i').setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle-2');
  toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
  toast.classList.add('translate-y-0');
  lucide.createIcons();
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-4');
  }, 2000);
}

function showSyncStatus() {
  syncStatus.classList.remove('opacity-0');
  setTimeout(() => syncStatus.classList.add('opacity-0'), 1500);
}

async function exportPDF() {
  const bulan = filterBulan.value;
  const filtered = keuanganData.filter(t => t.tanggal.startsWith(bulan)).sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
  
  if (filtered.length === 0) return showToast('Tidak ada data untuk diexport', true);
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ format: 'a4' });
  
  const periode = new Date(bulan + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(16, 185, 129);
  doc.text('Rekap Keuangan', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${periode}`, 14, 28);
  doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 34);
  
  const tableData = filtered.map(t => [
    formatTanggalIndo(t.tanggal),
    t.tipe === 'masuk' ? 'Masuk' : 'Keluar',
    t.kategori,
    t.keterangan,
    (t.tipe === 'masuk' ? '+ ' : '- ') + formatRupiah(t.jumlah)
  ]);
  
  doc.autoTable({
    startY: 40,
    head: [['Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah']],
    body: tableData,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right' }, 0: { cellWidth: 22 }, 1: { cellWidth: 18 } },
    alternateRowStyles: { fillColor: [249, 250, 251] }
  });
  
  const totalMasuk = filtered.filter(t => t.tipe === 'masuk').reduce((s, t) => s + t.jumlah, 0);
  const totalKeluar = filtered.filter(t => t.tipe === 'keluar').reduce((s, t) => s + t.jumlah, 0);
  const finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text(`Total Pemasukan:`, 14, finalY);
  doc.text(`Total Pengeluaran:`, 14, finalY + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(`Saldo Akhir:`, 14, finalY + 14);
  
  doc.setFont('helvetica', 'normal');
  doc.text(formatRupiah(totalMasuk), 60, finalY, { align: 'left' });
  doc.text(formatRupiah(totalKeluar), 60, finalY + 7, { align: 'left' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(formatRupiah(totalMasuk - totalKeluar), 60, finalY + 14, { align: 'left' });
  
  doc.save(`rekap-keuangan-${bulan}.pdf`);
  showToast('PDF berhasil diexport');
}

async function syncToGAS() {
  if (!GAS_URL) return;
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', data: keuanganData, timestamp: Date.now() })
    });
  } catch (e) { console.warn('Sync gagal:', e); }
}

async function loadFromGAS() {
  if (!GAS_URL) return;
  try {
    const res = await fetch(`${GAS_URL}?action=get&t=${Date.now()}`);
    if (!res.ok) return;
    const remote = await res.json();
    if (Array.isArray(remote) && remote.length > 0) {
      keuanganData = remote;
      saveData(false);
      render();
      showToast('Data disinkronkan dari cloud');
    }
  } catch (e) { console.warn('Load GAS gagal:', e); }
}

document.addEventListener('DOMContentLoaded', init);
window.deleteTransaksi = deleteTransaksi;
</script>
</body>
</html>
