/* Presentation-only bridge. It leaves calculator inputs, formulas, data, and outputs untouched. */
(() => {
  'use strict';
  const moduleId = document.documentElement.dataset.arusModule;
  const send = (type, detail = {}) => parent.postMessage({ channel: 'arus-offline-studio', moduleId, type, ...detail }, '*');
  window.addEventListener('error', event => send('error', { message: event.message || 'Calculator error' }));
  window.addEventListener('unhandledrejection', event => send('error', { message: event.reason?.message || String(event.reason) }));

  const translations = [
    ['Total metode', 'Method count'],
    ['Kelompok berdasarkan input identik.', 'Methods grouped by shared inputs.'],
    ['Semua persamaan di dalam kelompok menggunakan parameter numerik yang sama, tetapi belum tentu cocok untuk jenis kapal dan kondisi operasi yang sama. Pemeriksaan domain diberikan per metode.', 'Methods in a group share numerical inputs. Check each method domain for the vessel and operating conditions.'],
    ['Metode wake fraction dan thrust deduction tetap dipisahkan.', 'Choose wake fraction or thrust deduction.'],
    ['Kelompok gabungan menghitung semua varian atau metode yang mempunyai parameter persis sama.', 'Grouped methods calculate all variants that use the same inputs.'],
    ['Metode digabung hanya jika himpunan parameter input numeriknya sama persis. Varian tiap metode tetap dihitung secara terpisah.', 'Methods are grouped only when their input parameters match. Each method and variant is calculated separately.'],
    ['Metode ini memerlukan kombinasi input tersendiri dan tetap dapat dihitung langsung.', 'This method uses its own input group and can be calculated directly.'],
    ['Input yang memiliki kode sama dipakai bersama antarkelompok dan antarmodul. Tidak ada nilai yang diisi otomatis selain melalui tombol contoh.', 'Matching inputs are shared across groups and modules. Use Load Example Values to fill a sample case.'],
    ['Hasil berubah secara otomatis setelah nilai parameter diperbarui.', 'Results update automatically when you change an input.'],
    ['Formula asli, logika status, dan metadata audit dari ARUS v2.5 dipertahankan tanpa perubahan.', 'Use method-specific limits and warnings when interpreting these results.'],
    ['berarti rumus dapat dievaluasi, bukan sertifikasi kesesuaian domain empiris. Nilai di luar rentang umum 0 ≤ w,t < 1 atau di luar batas terverifikasi ditandai untuk ditinjau. Rumus Excel tidak ditampilkan.', 'means the equation can be evaluated. It does not certify method applicability. Values outside 0 ≤ w,t < 1 or verified limits require review.'],
    ['Metode gabungan — input identik', 'Grouped methods — shared inputs'],
    ['Metode individual — input khusus', 'Individual methods — dedicated inputs'],
    ['Kelompok metode / kombinasi parameter', 'Method group / input combination'],
    ['Menggunakan satu input bersama', 'Using shared inputs'],
    ['Satu metode khusus', 'Dedicated method'],
    ['Kelompok metode', 'Method group'],
    ['Jenis perhitungan', 'Calculation type'],
    ['Estimasi penurunan kecepatan aliran', 'Estimate the reduction in inflow speed'],
    ['Koefisien interaksi gaya dorong', 'Thrust interaction coefficient'],
    ['Numerik siap', 'Values calculated'],
    ['Status & pemeriksaan', 'Status and checks'],
    ['Buka Thrust Deduction', 'Open Thrust Deduction'],
    ['Buka Wake Fraction', 'Open Wake Fraction'],
    ['dipakai bersama oleh', 'shared by'],
    ['nilai contoh dimasukkan untuk kelompok aktif', 'example values loaded for this group'],
    ['Curva untuk', 'Curves for'],
    ['klik kandidat dari tabel untuk memperbarui diagram.', 'select a candidate row to update the diagram.'],
    ['Status perhitungan', 'Calculation status'],
    ['Fr target manual', 'Manual target Fr'],
    ['persamaan terpilih', 'selected equations'],
    ['model terhitung', 'models calculated'],
    ['model maksimum', 'models maximum'],
    ['Tindakan', 'Actions'],
    ['Catatan', 'Note'],
    ['terpilih', 'selected'],
    ['kelompok', 'groups'],
    ['klik', 'select'],
    ['Koefisien tahanan sisa model dipindahkan ke kapal pada bilangan Froude yang sama.', 'Transfers the model residual-resistance coefficient to the ship at the same Froude number.'],
    ['Koefisien gelombang dipertahankan; tahanan viskos dihitung dengan faktor bentuk (1+k).', 'Preserves wave resistance and calculates viscous resistance using the form factor (1+k).'],
    ['Regresi beberapa titik tahanan model untuk memperkirakan faktor bentuk (1+k). Tidak menghitung RTS/PE.', 'Uses model resistance measurements to estimate the form factor (1+k). This method does not calculate full-scale resistance or effective power.'],
    ['Regresi CT = a + b·CF menggunakan beberapa model yang sebangun pada Froude sebanding.', 'Fits CT = a + b·CF using geometrically similar models at comparable Froude numbers.'],
    ['Ekstrapolasi gaya Froude menggunakan garis gesekan Schoenherr dan allowance tradisional.', 'Uses Froude extrapolation with the Schoenherr friction line and a traditional allowance.'],
    ['Ekstrapolasi menggunakan garis korelasi ITTC 1957 dengan atau tanpa faktor bentuk.', 'Uses the ITTC 1957 friction line, with or without a form factor.'],
    ['Rekonstruksi tahanan kapal dari tahanan model, faktor bentuk, koreksi kekasaran, dan allowance.', 'Calculates ship resistance from model resistance, form factor, roughness correction, and allowances.'],
    ['Koefisien gesekan historis: RF = f·S·V^1.825, untuk perbandingan historis.', 'Uses the historical friction relation RF = f·S·V^1.825 for comparison.'],
    ['Prohaska hanya menghasilkan 1+k; garis gesekan pada lembar Excel tercatat sebagai pilihan tetapi rumus regresinya tetap memakai ITTC 1957.', 'Prohaska returns 1+k only. The regression uses ITTC 1957 even when a different friction line is listed in the source workbook.'],
    ['Regresi Telfer dari enam model geosim; formula mengikuti worksheet 04_Geosim_Telfer.', 'Telfer regression uses up to six geometrically similar models.'],
    ['Metode historis; perhatikan batas panjang dan risiko transisi pada model kecil.', 'Historical method: check length limits and the risk of transitional flow on small models.'],
    ['Kolom override kosong menggunakan nilai dari geometri/global. Mode manual dapat digunakan ketika workbook memberikan opsi override.', 'Blank overrides use the geometry and water-property inputs. Use Manual only where the method supports an override.'],
    ['Telfer menggunakan regresi CT = a + b·CF; status memeriksa jumlah model dan rentang Fr sesuai toleransi workbook.', 'Telfer fits CT = a + b·CF. The status checks the number of models and their Froude-number spread.'],
    ['Angka ditampilkan dengan pembulatan. Perhitungan internal tidak dibulatkan.', 'Displayed values are rounded; calculations retain full precision.'],
    ['Data diproses secara lokal di browser · tidak memerlukan koneksi internet', 'Calculated locally in your browser · no internet connection required'],
    ['Nilai awal adalah contoh dari data uji workbook, bukan data kapal Anda. Ganti sesuai kondisi kapal; perubahan tersimpan pada perangkat ini.', 'Example values are provided. Replace them with your measured data.'],
    ['Hasil mengikuti persamaan sumber.', 'Results use the selected method equations.'],
    ['tidak otomatis menjamin kesesuaian domain empiris untuk kapal tertentu.', 'does not guarantee that the method applies to your vessel.'],
    ['Status berhasil', 'A successful calculation'],
    ['Hasil diperbarui saat parameter diubah.', 'Results update when you change an input.'],
    ['Kelompok ini tidak membutuhkan input numerik.', 'This group does not require numerical inputs.'],
    ['Metode / kelompok input', 'Method / input group'],
    ['Model pengujian geosim', 'Geosim model tests'],
    ['Diperlukan minimal 3 model geosim pada Fr sebanding.', 'Enter at least three geometrically similar models at comparable Froude numbers.'],
    ['Jika luas basah setiap model kosong, Excel menghitung', 'If a model wetted area is blank, it is calculated as'],
    ['Seperti MODEL_SETUP Excel, volume displacement digunakan untuk dokumentasi/QC, bukan rumus ekstrapolasi tahanan.', 'Displacement volume is used for documentation and quality checks, not for resistance extrapolation.'],
    ['Luas penampang maksimum model', 'Maximum model cross-sectional area'],
    ['Area transversal atas air', 'Above-water transverse area'],
    ['Kekasaran ekuivalen', 'Equivalent roughness'],
    ['Target bilangan Froude', 'Target Froude number'],
    ['Bilangan Fr target', 'Target Froude number'],
    ['Toleransi sebaran Fr', 'Froude-number spread tolerance'],
    ['Allowance tambahan', 'Additional allowance'],
    ['Gravitasi override', 'Gravity override'],
    ['Daya efektif', 'Effective power'],
    ['Koefisien total', 'Total resistance coefficient'],
    ['Kosongkan input pengujian', 'Clear test inputs'],
    ['Garis gesekan (tercatat di Excel)', 'Friction line (source record)'],
    ['Sumber faktor bentuk', 'Form-factor source'],
    ['Faktor bentuk manual', 'Manual form factor'],
    ['Eksponen Prohaska untuk', 'Prohaska exponent for'],
    ['Eksponen Prohaska', 'Prohaska exponent'],
    ['Eksponen n manual', 'Manual exponent n'],
    ['Nilai n manual', 'Manual exponent n'],
    ['Koefisien f kapal', 'Ship friction coefficient f'],
    ['Koefisien f model', 'Model friction coefficient f'],
    ['Metode koreksi kekasaran', 'Roughness-correction method'],
    ['kS khusus metode', 'Method-specific kS'],
    ['Garis gesekan', 'Friction line'],
    ['Varian ekstrapolasi', 'Extrapolation variant'],
    ['Dari Prohaska', 'From Prohaska'],
    ['Input RT & D → hasil RPM & daya', 'Known resistance and diameter → RPM and power'],
    ['Input daya & RPM → hasil D & RT', 'Known power and RPM → diameter and resistance'],
    ['Perhitungan berlangsung lokal tanpa koneksi internet.', 'Calculated locally without an internet connection.'],
    ['Koefisien asli dari workbook', 'Source coefficient data'],
    ['Propeller terpilih', 'Recommended propeller'],
    ['Karakteristik open-water · skala koefisien asli', 'Open-water characteristics'],
    ['KT, 10KQ dan η₀ berbagi satu sumbu Y tanpa normalisasi. KTn hanya ditampilkan jika ada koefisien sumber.', 'KT, 10KQ and η₀ share one unscaled Y-axis. Nozzle thrust is shown only when separate source coefficients are available.'],
    ['Scroll / cubit: zoom · Seret: geser', 'Scroll or pinch to zoom · drag to pan'],
    ['Tanpa normalisasi / sumbu sekunder', 'Original values · single Y-axis'],
    ['J operasi: KT prop = KT Ship', 'Operating J: propeller KT = required KT'],
    ['J operasi: 10KQ prop = 10KQ Power', 'Operating J: propeller 10KQ = power 10KQ'],
    ['Sumbu Y', 'Y-axis'],
    ['KQ prop = KQ daya', 'Propeller KQ = power KQ'],
    ['KT prop = KT ship', 'Propeller KT = required KT'],
    ['Jumlah propeller', 'Number of propellers'],
    ['Diameter propeller', 'Propeller diameter'],
    ['Air & tekanan', 'Water and pressure'],
    ['Kedalaman poros dari permukaan', 'Shaft immersion'],
    ['Massa jenis air', 'Water density'],
    ['Viskositas kinematik', 'Kinematic viscosity'],
    ['Tekanan atmosfer', 'Atmospheric pressure'],
    ['Tekanan uap', 'Vapour pressure'],
    ['Efisiensi & kavitasi', 'Efficiency and cavitation'],
    ['Efisiensi shaft', 'Shaft efficiency ηₛ'],
    ['Efisiensi transmisi', 'Transmission efficiency ηₜ'],
    ['η kerja', 'η₀'],
    ['η tidak tersedia', 'η₀ unavailable'],
    ['Toleransi residual KT', 'KT residual tolerance'],
    ['Toleransi residual KQ', 'KQ residual tolerance'],
    ['Kriteria kavitasi', 'Cavitation criterion'],
    ['Safety margin kavitasi', 'Cavitation safety margin'],
    ['Efisiensi terbaik', 'Best open-water efficiency'],
    ['Kandidat valid', 'Eligible candidates'],
    ['Tanpa dimensi', 'Dimensionless'],
    ['termasuk sea margin', 'including sea margin'],
    ['Peringkat kandidat', 'Candidate ranking'],
    ['klik baris untuk melihat kurva', 'select a row to view its curves'],
    ['10 efisiensi tertinggi dari kandidat yang memenuhi syarat.', 'Top 10 eligible candidates by open-water efficiency.'],
    ['Seluruh kandidat yang valid · urutan efisiensi tertinggi.', 'All eligible candidates, ordered by open-water efficiency.'],
    ['10 terbaik · berdasarkan efisiensi open-water η₀.', 'Top 10 candidates by open-water efficiency η₀.'],
    ['Semua valid', 'All eligible'],
    ['Ekspor CSV', 'Export CSV'],
    ['Tipe / seri', 'Type / series'],
    ['Daya (kW)', 'Engine Power (kW)'],
    ['Terbaik per jumlah bilah / famili', 'Best by blade count / family'],
    ['Pilih baris untuk melihat kurva dan titik operasi kandidat.', 'Select a row to view the candidate curves and operating point.'],
    ['Input diketahui · mesin & operasi', 'Known engine and operating conditions'],
    ['Daya mesin total (brake power)', 'Engine Power (brake power)'],
    ['RPM mesin', 'Engine RPM'],
    ['Rasio gearbox (n mesin / n prop)', 'Gear ratio (engine / propeller RPM)'],
    ['Kecepatan kapal pada titik desain', 'Design vessel speed'],
    ['Diameter · rentang pencarian', 'Diameter search range'],
    ['Daya terkirim total', 'Total delivered power'],
    ['setelah gearbox', 'after reduction gear'],
    ['seluruh propeller', 'all propellers'],
    ['J pada perpotongan', 'Operating J'],
    ['10KQ prop / daya', 'Propeller / power 10KQ'],
    ['kurva berhenti sebelum nilai negatif', 'curve ends before negative values'],
    ['batas domain; tidak ditemukan KT/KQ negatif sebelumnya', 'domain limit; no earlier negative KT/KQ value'],
    ['akar', 'zero of'],
    ['Konfigurasi', 'Configuration'],
    ['Koef.', 'Coefficient'],
    ['persamaan', 'equations'],
    ['menghasilkan', 'returns'],
    ['kandidat', 'candidates'],
    ['kombinasi', 'combinations'],
    ['dievaluasi', 'evaluated'],
    ['ditampilkan', 'shown'],
    ['Sebelum', 'Previous'],
    ['Berikut', 'Next'],
    ['Kavitasi', 'Cavitation'],
    ['daya', 'power'],
    ['kurva', 'curves'],
    ['memperbarui', 'update'],
    ['tabel', 'table'],
    ['perpotongan', 'intersection'],
    ['terbaik', 'best'],
    ['sebelum pembulatan', 'before rounding'],
    ['Perbandingan hasil Wake Fraction', 'Wake Fraction Comparison'],
    ['Perbandingan hasil Thrust Deduction', 'Thrust Deduction Comparison'],
    ['TAMPILKAN', 'Show'],
    ['SEMBUNYIKAN', 'Hide'],
    ['KOREKSI KONDISI MUAT', 'LOAD CONDITION CORRECTIONS'],
    ['VARIASI PEMBEBANAN', 'LOADING VARIATIONS'],
    ['PENGUKURAN / IDENTITAS', 'MEASUREMENTS / IDENTIFICATION'],
    ['RELASI LOKAL', 'LOCAL RELATIONSHIPS'],
    ['REGRESI / PRAKIRAAN', 'REGRESSION / ESTIMATION'],
    ['IDENTITAS KOEFISIEN', 'COEFFICIENT IDENTIFICATION'],
    ['TIDAK TERDEFINISI', 'UNDEFINED'],
    ['PERLU TINJAUAN', 'REVIEW REQUIRED'],
    ['PERINGATAN DOMAIN / NUMERIK', 'DOMAIN / NUMERICAL WARNING'],
    ['PARAMETER BELUM LENGKAP', 'INCOMPLETE INPUTS'],
    ['BATAS EMPIRIS BELUM DIVERIFIKASI', 'EMPIRICAL LIMITS NOT VERIFIED'],
    ['PENGATURAN', 'SETTINGS'],
    ['KONDISI KAPAL', 'VESSEL CONDITIONS'],
    ['KONDISI UJI', 'TEST CONDITIONS'],
    ['HASIL EKSTRAPOLASI', 'EXTRAPOLATION RESULTS'],
    ['PARAMETER PERHITUNGAN', 'CALCULATION PARAMETERS'],
    ['TABEL HASIL', 'RESULTS TABLE'],
    ['NILAI HASIL', 'RESULT VALUES'],
    ['PILIH METODE', 'SELECT METHOD'],
    ['PILIH SERI', 'SELECT SERIES'],
    ['PILIH VARIASI', 'SELECT VARIANT'],
    ['DATA KAPAL', 'VESSEL DATA'],
    ['DATA MODEL', 'MODEL DATA'],
    ['DATA KAPAL MODEL', 'VESSEL AND MODEL DATA'],
    ['JALANKAN PERHITUNGAN', 'RUN CALCULATION'],
    ['HITUNG SEKARANG', 'CALCULATE NOW'],
    ['PERHITUNGAN SELESAI', 'CALCULATION COMPLETE'],
    ['PERHITUNGAN GAGAL', 'CALCULATION FAILED'],
    ['NILAI TIDAK VALID', 'INVALID VALUE'],
    ['BELUM TERSEDIA', 'NOT AVAILABLE'],
    ['TIDAK TERSEDIA', 'NOT AVAILABLE'],
    ['BELUM DIVERIFIKASI', 'NOT VERIFIED'],
    ['BELUM TERVERIFIKASI', 'NOT VERIFIED'],
    ['BATAS DOMAIN EMPIRIS', 'EMPIRICAL DOMAIN LIMITS'],
    ['BATAS DOMAIN', 'DOMAIN LIMITS'],
    ['HASIL PER METODE', 'RESULTS BY METHOD'],
    ['HASIL PER KELOMPOK', 'RESULTS BY GROUP'],
    ['PENGGUNAAN YANG DISARANKAN', 'RECOMMENDED USE'],
    ['BATASAN METODE', 'METHOD LIMITATIONS'],
    ['KETERANGAN METODE', 'METHOD NOTES'],
    ['RINGKASAN METODE', 'METHOD SUMMARY'],
    ['PERHITUNGAN OTOMATIS', 'AUTOMATIC CALCULATION'],
    ['PERHITUNGAN MANUAL', 'MANUAL CALCULATION'],
    ['FAKTOR KOREKSI', 'CORRECTION FACTOR'],
    ['FAKTOR GEOMETRI', 'GEOMETRY FACTOR'],
    ['KOEFISIEN TAHANAN', 'RESISTANCE COEFFICIENT'],
    ['KOEFISIEN GESEK', 'FRICTION COEFFICIENT'],
    ['KOEFISIEN VISKOS', 'VISCOUS COEFFICIENT'],
    ['PERBANDINGAN', 'COMPARISON'],
    ['ESTIMASI', 'ESTIMATE'],
    ['PERKIRAAN', 'ESTIMATE'],
    ['PENDEKATAN', 'APPROACH'],
    ['HUBUNGAN', 'RELATIONSHIP'],
    ['PEMBATASAN', 'LIMITATIONS'],
    ['KETERBATASAN', 'LIMITATIONS'],
    ['KEWAJIBAN INPUT', 'REQUIRED INPUTS'],
    ['PENGARUH', 'EFFECT'],
    ['TRANSISI', 'TRANSITION'],
    ['KEKENTALAN KINEMATIS', 'KINEMATIC VISCOSITY'],
    ['KEKENTALAN DINAMIS', 'DYNAMIC VISCOSITY'],
    ['KERJA', 'WORK'],
    ['SUMBER', 'SOURCE'],
    ['DOKUMEN', 'DOCUMENT'],
    ['BUKU KERJA', 'WORKBOOK'],
    ['HASIL', 'RESULTS'],
    ['PERINGATAN', 'WARNING'],
    ['VALID', 'VALID'],
    ['TIDAK VALID', 'INVALID'],
    ['KELENGKAPAN', 'COMPLETENESS'],
    ['KELENGKAPAN INPUT', 'INPUT COMPLETENESS'],
    ['DATA TERUKUR', 'MEASURED DATA'],
    ['DATA HASIL', 'RESULT DATA'],
    ['NILAI TERUKUR', 'MEASURED VALUE'],
    ['NILAI HASIL', 'RESULT VALUE'],
    ['DIHITUNG OTOMATIS', 'CALCULATED AUTOMATICALLY'],
    ['DIPILIH OTOMATIS', 'SELECTED AUTOMATICALLY'],
    ['JANGAN', 'Do not'],
    ['KONDISI', 'Condition'],
    ['KOEFISIEN', 'Coefficient'],
    ['GESEK', 'friction'],
    ['KASARAN', 'roughness'],
    ['TENGGELAM', 'submerged'],
    ['PENGARUH', 'effect'],
    ['PERMUKAAN', 'surface'],
    ['REGRESI', 'regression'],
    ['EKSPERIMEN', 'experiment'],
    ['DATA UJI', 'test data'],
    ['UJI', 'test'],
    ['Tidak ada', 'None'],
    ['Belum ada', 'Not available yet'],
    ['Belum dipilih', 'Not selected'],
    ['Belum dihitung', 'Not calculated'],
    ['Tidak dihitung', 'Not calculated'],
    ['Tidak digunakan', 'Not used'],
    ['Tidak diketahui', 'Unknown'],
    ['Tidak memenuhi', 'Does not meet'],
    ['Tidak boleh', 'Must not'],
    ['Di luar rentang', 'Outside the range'],
    ['Di dalam rentang', 'Within the range'],
    ['Berdasarkan', 'Based on'],
    ['menggunakan', 'using'],
    ['digunakan', 'used'],
    ['dihitung', 'calculated'],
    ['menghitung', 'calculate'],
    ['memerlukan', 'requires'],
    ['diperlukan', 'required'],
    ['dibutuhkan', 'required'],
    ['tersedia', 'available'],
    ['menampilkan', 'display'],
    ['menentukan', 'determine'],
    ['masukan', 'input'],
    ['keluaran', 'output'],
    ['Persamaan', 'Equation'],
    ['persamaan', 'equation'],
    ['rumus', 'formula'],
    ['faktor', 'factor'],
    ['batas', 'limit'],
    ['rentang', 'range'],
    ['empiris', 'empirical'],
    ['kondisi', 'condition'],
    ['muat', 'loading'],
    ['beban', 'load'],
    ['tunggal', 'single'],
    ['ganda', 'twin'],
    ['validasi', 'validation'],
    ['kesalahan', 'error'],
    ['peringatan', 'warning'],
    ['periksa', 'check'],
    ['Tinjau', 'Review'],
    ['Perlu', 'Required'],
    ['Wajib', 'Required'],
    ['opsional', 'optional'],
    ['sumber', 'source'],
    ['kapasitas', 'capacity'],
    ['koefisien', 'coefficient'],
    ['kedalaman', 'depth'],
    ['kolam', 'tank'],
    ['permukaan', 'surface'],
    ['transversal', 'transverse'],
    ['penampang', 'cross-section'],
    ['maksimum', 'maximum'],
    ['minimum', 'minimum'],
    ['ditampilkan', 'shown'],
    ['hasil', 'result'],
    ['nilai', 'value'],
    ['pilihan', 'selection'],
    ['pilih', 'select'],
    ['pakai', 'use'],
    ['kelompok', 'group'],
    ['perbandingan', 'comparison'],
    ['kecepatan', 'speed'],
    ['panjang', 'length'],
    ['luas', 'area'],
    ['volume', 'volume'],
    ['kapal', 'vessel'],
    ['lingkungan', 'environment'],
    ['pengujian', 'test'],
    ['pengukuran', 'measurement'],
    ['ekstrapolasi', 'extrapolation'],
    ['otomatis', 'automatic'],
    ['manual', 'manual'],
    ['kosong', 'blank'],
    ['terukur', 'measured'],
    ['terhitung', 'calculated'],
    ['lengkap', 'complete'],
    ['seperti', 'as in'],
    ['ketika', 'when'],
    ['saat', 'when'],
    ['pada', 'at'],
    ['dari', 'from'],
    ['dengan', 'with'],
    ['untuk', 'for'],
    ['yang', 'that'],
    ['dan', 'and'],
    ['atau', 'or'],
    ['serta', 'and'],
    ['sebagai', 'as'],
    ['adalah', 'is'],
    ['merupakan', 'is'],
    ['dapat', 'can'],
    ['jika', 'if'],
    ['maka', 'then'],
    ['bernilai', 'has a value of'],
    ['lebih', 'more'],
    ['kurang', 'less'],
    ['sama', 'equal'],
    ['bukan', 'not'],
    ['belum', 'not yet'],
    ['tidak', 'not'],
    ['WAJIB DIISI', 'REQUIRED'],
    ['ISI NILAI', 'ENTER A VALUE'],
    ['MASUKKAN NILAI', 'ENTER A VALUE'],
    ['NILAI CONTOH', 'EXAMPLE VALUE'],
    ['PENGATURAN METODE', 'METHOD SETTINGS'],
    ['PENGATURAN INPUT', 'INPUT SETTINGS'],
    ['HASIL PERHITUNGAN', 'CALCULATION RESULTS'],
    ['DATA MASUKAN', 'INPUT DATA'],
    ['KONDISI AWAL', 'INITIAL CONDITIONS'],
    ['NILAI AWAL', 'INITIAL VALUE'],
    ['MODE MANUAL', 'MANUAL MODE'],
    ['MODE OTOMATIS', 'AUTOMATIC MODE'],
    ['HASIL OTOMATIS', 'AUTOMATIC RESULTS'],
    ['NILAI OTOMATIS', 'AUTOMATIC VALUE'],
    ['KOEFISIEN', 'COEFFICIENT'],
    ['KECEPATAN MODEL', 'MODEL SPEED'],
    ['KECEPATAN KAPAL', 'VESSEL SPEED'],
    ['TAHANAN TERUKUR', 'MEASURED RESISTANCE'],
    ['FAKTOR BENTUK', 'FORM FACTOR'],
    ['FAKTOR SKALA', 'SCALE FACTOR'],
    ['FUNGSI', 'FUNCTION'],
    ['KEMBALI', 'Back'],
    ['LANJUT', 'Continue'],
    ['HAPUS', 'Delete'],
    ['SIMPAN', 'Save'],
    ['BATAL', 'Cancel'],
    ['TUTUP', 'Close'],
    ['Model-to-ship length scale ratio', 'Model-to-ship length scale ratio'],
    ['Metode ekstrapolasi', 'Extrapolation Method'],
    ['Geometri dan skala model', 'Model Geometry and Scale'],
    ['Data pengujian model', 'Model Test Data'],
    ['Pengukuran towing tank', 'Towing Tank Measurements'],
    ['Pengujian model sebangun', 'Geosim Model Tests'],
    ['Parameter metode', 'Method Parameters'],
    ['Kurva hasil pengujian', 'Test Results'],
    ['Hasil per titik uji', 'Results by Test Point'],
    ['Metode perhitungan', 'Calculation Method'],
    ['Parameter input', 'Input Parameters'],
    ['Hasil perhitungan', 'Calculation Results'],
    ['Pilih koefisien', 'Select a Coefficient'],
    ['Pilih kebutuhan input', 'Select Required Inputs'],
    ['Masukkan parameter', 'Enter Parameters'],
    ['Pulihkan nilai contoh', 'Restore Example Values'],
    ['Pulihkan contoh', 'Restore Example Values'],
    ['Isi contoh', 'Load Example Values'],
    ['Kosongkan kelompok', 'Clear Group'],
    ['Reset semua', 'Reset All'],
    ['Ekspor input JSON', 'Export Inputs as JSON'],
    ['Impor input JSON', 'Import Inputs from JSON'],
    ['Cetak hasil', 'Print Results'],
    ['HITUNG & PILIH PROPELLER', 'CALCULATE & SELECT PROPELLER'],
    ['HITUNG & CARI DIAMETER', 'CALCULATE & FIND DIAMETER'],
    ['Dimensi full-scale', 'Full-Scale Dimensions'],
    ['Tahanan total kapal', 'Total Ship Resistance'],
    ['Kecepatan kapal', 'Ship Speed'],
    ['Panjang kapal', 'Ship Length'],
    ['Luas basah kapal', 'Ship Wetted Area'],
    ['Panjang model', 'Model Length'],
    ['Luas basah model', 'Model Wetted Area'],
    ['Rasio skala', 'Scale Ratio'],
    ['Properti air dan lingkungan uji', 'Water Properties and Test Conditions'],
    ['Koreksi blockage / Schuster', 'Blockage / Schuster Correction'],
    ['Metode koreksi', 'Correction Method'],
    ['Kedalaman kolam', 'Tank Depth'],
    ['Luas penampang kolam', 'Tank Cross-Sectional Area'],
    ['Luas penampang maksimum model', 'Maximum Model Cross-Sectional Area'],
    ['Blockage factor', 'Blockage Factor'],
    ['Kecepatan dan tahanan terukur', 'Measured Speed and Resistance'],
    ['maksimum', 'maximum'],
    ['Kosong', 'Blank'],
    ['otomatis dari skala', 'calculated automatically from scale'],
    ['digunakan untuk dokumentasi/QC, bukan rumus ekstrapolasi tahanan', 'used for documentation and quality checks, not in the resistance extrapolation formula'],
    ['dapat diisi di tabel ketika koreksi diaktifkan', 'can be entered in the table when the correction is enabled'],
    ['Dasar perhitungan mengikuti TEST_DATA workbook.', 'The calculation follows the TEST_DATA workbook.'],
    ['Perhitungan berasal dari formula worksheet metode terpilih. Tidak ada pembulatan pada perhitungan internal.', 'Calculated using the selected method worksheet. Internal values are not rounded.'],
    ['Regresi Prohaska', 'Prohaska Regression'],
    ['Regresi geosim', 'Geosim Regression'],
    ['titik terhitung', 'points calculated'],
    ['data lengkap', 'complete data'],
    ['dipilih', 'selected'],
    ['peringatan kelayakan hasil', 'Result Validity Warning'],
    ['status metode Excel', 'method status'],
    ['Otomatis', 'Automatic'],
    ['Opsional', 'Optional'],
    ['contoh', 'example'],
    ['Run', 'Run'],
    ['Geometri valid', 'Geometry valid'],
    ['Panjang', 'Length'],
    ['Lebar', 'Width'],
    ['Tahanan', 'Resistance'],
    ['Tahanan kapal', 'Ship Resistance'],
    ['Kapal penuh', 'Full-Scale Vessel'],
    ['Kecepatan', 'Speed'],
    ['Luas', 'Area'],
    ['basah', 'wetted'],
    ['Rasio', 'Ratio'],
    ['skala', 'scale'],
    ['Jumlah', 'Number of'],
    ['propeller', 'propeller'],
    ['Kekasaran', 'Roughness'],
    ['ekuivalen', 'equivalent'],
    ['Percepatan gravitasi', 'Gravitational Acceleration'],
    ['Luas transversal atas air', 'Transverse Above-Water Area'],
    ['Volume displacement', 'Displacement Volume'],
    ['Volume', 'Volume'],
    ['Metode', 'Method'],
    ['Perhitungan', 'Calculation'],
    ['ekstrapolasi', 'extrapolation'],
    ['Pengujian', 'Test'],
    ['Pengukuran', 'Measurement'],
    ['Data', 'Data'],
    ['Masukkan', 'Enter'],
    ['Pilih', 'Select'],
    ['Hasil', 'Results'],
    ['Parameter', 'Parameter'],
    ['Kapal', 'Vessel'],
    ['model', 'model'],
    ['titik', 'point'],
    ['run', 'run'],
    ['dari', 'of'],
    ['dengan', 'with'],
    ['untuk', 'for'],
    ['yang', 'that'],
    ['dan', 'and'],
    ['atau', 'or'],
    ['manual', 'manual'],
    ['kosong', 'blank'],
    ['terukur', 'measured'],
    ['terhitung', 'calculated'],
    ['dipilih', 'selected'],
    ['kapal', 'vessel']
  ].filter(([source,target]) => source.toLowerCase() !== target.toLowerCase()).sort((a, b) => b[0].length - a[0].length);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = translations.map(([source,target]) => {
    const boundary = /^[\p{L}\p{N}]/u.test(source[0]) && /[\p{L}\p{N}]$/u.test(source.at(-1));
    const pattern = boundary ? `(?<![\\p{L}\\p{N}])${escape(source)}(?![\\p{L}\\p{N}])` : escape(source);
    return [new RegExp(pattern,'giu'),target];
  });
  const textCache = new Map();
  function translate(value) {
    if(textCache.has(value))return textCache.get(value);
    let result = value;
    for (const [pattern,target] of rules) result=result.replace(pattern,target);
    // Notation only, never values, identifiers, units, option values or equations.
    result=result.replace(/(?<![\p{L}\p{N}_])A(?:E|ₑ)\s*\/\s*A(?:0|O|₀)(?![\p{L}\p{N}_])/giu,'Aₑ/A₀').replace(/\beta0\b/g,'η₀').replace(/\b(?:Ho|H0)\b(?=\s*(?:\[|\(|$))/g,'η₀');
    if(textCache.size>4000)textCache.clear();textCache.set(value,result);
    return result;
  }
  function hideInternalStatus() {
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length) return;
      const text = element.textContent.trim();
      if (text === 'READY' || text === 'VALID_SOURCE_FAMILY_CASE') {
        element.classList.add('arus-internal-hidden');
      }
    });
    document.querySelectorAll('body *').forEach(element => {
      if (element.children.length > 4) return;
      if (/source-declared domain status/i.test(element.textContent) && element.textContent.length < 180) {
        const row = element.closest('.statusrow,.statitem,.result-row,.resultitem,.metric-row') || element.parentElement;
        if (row) row.classList.add('arus-internal-hidden');
      }
    });
  }
  function translatePage() {
    // Presentation only: retain native export routines, but expose no download UI.
    document.querySelectorAll('button,a,[role="menuitem"],input[type="button"]').forEach(el=>{
      const label=(el.textContent||el.value||'').trim();
      if (/\b(download|export|unduh|ekspor)\b|^(?:2D offsets|3D offsets|STL|OBJ|Radial CSV|PLY mesh|DXF section|PDF report|Project \.pgeo|Rhino surface)/i.test(label) || el.hasAttribute('download')) el.classList.add('arus-export-hidden');
    });
    document.querySelectorAll('option:not([value])').forEach(option => option.setAttribute('value',option.value));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,code,pre,textarea')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const translated = translate(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    });
    if (moduleId === 'geometry') {
      const status = document.getElementById('status');
      if (status && /GEOMETRY VALID/i.test(status.textContent)) status.textContent = 'Geometry valid';
    }
    document.querySelectorAll('[placeholder],[aria-label],[title],optgroup[label]').forEach(element => {
      for (const attribute of ['placeholder', 'aria-label', 'title', ...(element.tagName==='OPTGROUP'?['label']:[])]) {
        if (element.hasAttribute(attribute)) {
          const original = element.getAttribute(attribute);
          const translated = translate(original);
          if (translated !== original) element.setAttribute(attribute, translated);
        }
      }
    });
    document.querySelectorAll('.formrow,.field').forEach(row=>{
      const label=[...row.children].find(element=>element.tagName==='LABEL');
      const control=row.querySelector('input[id],select[id],textarea[id]');
      if(label&&control&&!label.htmlFor)label.htmlFor=control.id;
    });
    document.querySelectorAll('.sec-tag,.phead>small').forEach(element=>{
      const clean=element.textContent.replace(/^\s*0\d\s*(?:\/\s*)?/,'').trim();
      if(clean!==element.textContent)element.textContent=clean;
    });
    hideInternalStatus();
  }
  function installCanvasTranslation() {
    if (!window.CanvasRenderingContext2D) return;
    const original = CanvasRenderingContext2D.prototype.fillText;
    const measure = CanvasRenderingContext2D.prototype.measureText;
    const normalizeFont = context => { const font=context.font.replace(/(\d+(?:\.\d+)?px)\s+.*$/, '$1 Arial, sans-serif'); if(font!==context.font)context.font=font; };
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) { normalizeFont(this); return original.call(this, translate(String(text)), ...args); };
    CanvasRenderingContext2D.prototype.measureText = function (text) { normalizeFont(this); return measure.call(this, translate(String(text))); };
  }
  installCanvasTranslation();
  window.addEventListener('DOMContentLoaded', () => {
    document.body.dataset.arusModule = moduleId;
    const installMethodCards=(select,{label='Choose a method',note,readNotes=()=>''}={})=>{
      if(!select)return null;
      const host=select.parentElement;
      if(!host)return null;
      host.classList.add('arus-method-control');
      select.classList.add('arus-method-select-native');
      const sourceLabel=document.querySelector(`label[for="${select.id}"]`);
      if(sourceLabel)sourceLabel.classList.add('arus-method-label-native');
      const cards=document.createElement('div');cards.className='arus-method-cards';cards.setAttribute('role','group');cards.setAttribute('aria-label',label);
      const guidance=document.createElement('div');guidance.className='arus-method-limit-note';guidance.setAttribute('role','note');
      guidance.innerHTML='<strong>Method limitations</strong><ul class="arus-method-limit-list"></ul>';
      host.append(cards);
      host.after(guidance);
      const isHullPicker=moduleId==='resistance'&&select.id==='method';
      let hullOpen=isHullPicker;
      let hullToolbar=null,hullTitle=null,hullToggle=null;
      const groups=[
        {title:'Displacement hulls',caption:'Conventional displacement and merchant vessels',methods:[
          ['R01','Harvald–Guldhammer','Residual-resistance diagram'],['R02','Holtrop–Mennen','Displacement hull prediction'],
          ['R03','Hollenbach','Merchant-ship resistance'],['R04','Series 60 (BSRA)','Series-based hull prediction'],
          ['R05','Van Oortmerssen','Small-displacement vessels'],['R06','NPL Series 64','Systematic series resistance']]},
        {title:'Small craft & planing',caption:'Chine and high-speed operating regimes',methods:[
          ['R07','NTUA Double-Chine','Double-chine small craft'],['R08','Savitsky','Planing craft','planingVariant','savitsky'],
          ['R08','Series 62 / Radojčić','Planing hull series','planingVariant','series']]},
        {title:'Yachts & multihulls',caption:'Yachts and twin-hull vessels',methods:[
          ['R10','Delft Yacht Hull Series','Sailing yacht hulls'],['R09','Southampton Catamaran','Catamaran source family','catFamily','Southampton'],
          ['R09','VWS Catamaran','Catamaran source family','catFamily','VWS']]},
        {title:'Special vessels',caption:'Underwater and foil-supported craft',methods:[
          ['R11','Submarine / AUV','Submerged body resistance'],['R12','Hydrofoil','Foil and strut components']]}
      ];
      if(isHullPicker){
        host.classList.add('arus-hull-method-picker');
        hullToolbar=document.createElement('div');hullToolbar.className='arus-hull-toolbar';
        const info=document.createElement('div');
        const caption=document.createElement('span');caption.className='arus-hull-caption';caption.textContent='Selected resistance method';
        hullTitle=document.createElement('strong');hullTitle.className='arus-hull-current-name';
        hullToggle=document.createElement('button');hullToggle.type='button';hullToggle.className='arus-hull-toggle';
        hullToggle.addEventListener('click',()=>{hullOpen=!hullOpen;sync();});
        info.append(caption,hullTitle);hullToolbar.append(info,hullToggle);host.insertBefore(hullToolbar,cards);
      }
      const branchOf=(id)=>id==='R08'?(document.getElementById('planingVariant')?.value||'savitsky'):
        id==='R09'?(document.getElementById('catFamily')?.value||'Southampton'):'';
      const sync=()=>{
        const current=select.value;
        cards.replaceChildren();
        if(isHullPicker){
          cards.classList.add('arus-hull-catalog');
          const available=new Set([...select.options].map(option=>option.value));
          let selectedTitle=select.selectedOptions[0]?.textContent?.trim()||'Select a method';
          for(const group of groups){
            const section=document.createElement('section');section.className='arus-hull-group';
            const heading=document.createElement('div');heading.className='arus-hull-group-heading';
            const name=document.createElement('strong');name.textContent=group.title;
            const summary=document.createElement('span');summary.textContent=group.caption;
            heading.append(name,summary);
            const grid=document.createElement('div');grid.className='arus-hull-group-grid';
            for(const entry of group.methods){
              const [methodId,title,description,branchId,branchValue]=entry;
              if(!available.has(methodId))continue;
              const button=document.createElement('button');button.type='button';button.className='arus-hull-card';
              button.dataset.methodValue=methodId;
              if(branchValue)button.dataset.branchValue=branchValue;
              const pressed=methodId===current&&(!branchId||branchOf(methodId)===branchValue);
              button.setAttribute('aria-pressed',String(pressed));
              if(pressed)selectedTitle=title;
              const nameEl=document.createElement('span');nameEl.className='hull-card-title';nameEl.textContent=title;
              const descEl=document.createElement('span');descEl.className='hull-card-description';descEl.textContent=description;
              button.append(nameEl,descEl);
              if(pressed){const check=document.createElement('span');check.className='arus-hull-selected-glyph';check.textContent='✓';button.append(check);}
              button.addEventListener('click',()=>{
                const changed=select.value!==methodId;
                if(changed){select.value=methodId;select.dispatchEvent(new Event('change',{bubbles:true}));}
                if(branchId){
                  const source=document.getElementById(branchId);
                  if(source){source.value=branchValue;source.dispatchEvent(new Event('change',{bubbles:true}));}
                }
                hullOpen=false;sync();
              });
              grid.append(button);
            }
            if(grid.children.length){section.append(heading,grid);cards.append(section);}
          }
          hullTitle.textContent=selectedTitle;
          hullToggle.textContent=hullOpen?'Close method list':'Change method';
          cards.classList.toggle('arus-hull-hidden',!hullOpen);
        }else{
          for(const option of [...select.options]){
            if(!option.value)continue;
            const button=document.createElement('button');button.type='button';button.className='arus-method-card';button.dataset.methodValue=option.value;
            button.setAttribute('aria-pressed',String(option.value===current));
            const title=document.createElement('strong');title.textContent=option.textContent.trim().replace(/^(?:MT|R)\d+\s*/i,'').replace(/^[^\p{L}\p{N}]+/u,'').trim();
            button.append(title);button.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();});cards.append(button);
          }
        }
        setLimitations(readNotes()||note||'Select the method that matches your measured inputs and stay within its documented domain.');
        guidance.hidden=isHullPicker?hullOpen:cards.children.length<2;
      };
      const setLimitations=detail=>{
        const rows=(Array.isArray(detail)?detail:String(detail||'').split(/\n+/)).map(value=>String(value).trim()).filter(Boolean);
        const list=guidance.querySelector('.arus-method-limit-list');
        list.replaceChildren(...rows.map(value=>{const row=document.createElement('li');row.textContent=value.replace(/^•\s*/,'');return row;}));
      };
      select.addEventListener('change',sync);
      new MutationObserver(sync).observe(select,{childList:true,subtree:true,characterData:true});
      sync();
      return {cards,guidance,sync,setLimitations};
    };
    if(moduleId==='resistance'){
      const info=document.getElementById('methodInfo');
      const picker=installMethodCards(document.getElementById('method'),{label:'Ship resistance methods',readNotes:()=>{
        if(document.getElementById('method')?.value!=='R02'){
          const description=info?.querySelector('p')?.innerText?.trim();
          return description?[
            `Method scope: ${description}`,
            'Applicability: use the source-method warning and verify the vessel is within the method’s documented empirical domain.'
          ]:[];
        }
        return [
          'ARUS warning envelope: conventional displacement monohull',
          'ARUS warning envelope: length Froude number Fn_LWL 0 < Fn ≤ 0.45',
          'ARUS warning envelope: prismatic coefficient Cp 0.55–0.85',
          'ARUS warning envelope: length/breadth LWL/B 3.9–9.5',
          'Additional published check (PIAS summary): midship coefficient Cm 0.50–1.00',
          'Additional published check (PIAS summary): LCB within ±5% of LWL/2',
          'Additional published check (PIAS summary): broader Cp 0.40–0.93; this is not the ARUS warning range',
          'Additional published check (PIAS summary): waterline entrance half-angle ≤ 70°',
          'Additional published check (PIAS summary): bulb frontal area / midship area < 0.20',
          'Reference condition: calm water; seawater 1,025 kg/m³ at 15 °C',
          'Not intended for planing craft, hydrofoils, multihulls, or strongly non-conventional hulls'
        ];
      }});
      if(info&&picker){info.classList.add('arus-method-source-hidden');new MutationObserver(picker.sync).observe(info,{childList:true,subtree:true,characterData:true});}
    }
    if(moduleId==='model-test'){
      const method=document.getElementById('method');
      const methodLimits={
        MT01:['Inputs: measured model speed/resistance and model/ship geometry.','Applicability: transfer residual resistance at matching Froude number; selected friction line and allowances remain method-specific.','Use: review the method status and replace all example measurements with test data.'],
        MT02:['Inputs: measured towing-test data and a valid form factor (1+k), manual or from Prohaska.','Applicability: preserves the wave-resistance coefficient and applies the selected friction line to viscous resistance.','Use: verify the form-factor source and fluid-property inputs before interpreting full-scale results.'],
        MT03:['Inputs: multiple measured model-test points suitable for Prohaska regression.','Output boundary: estimates 1+k only; it does not calculate full-scale resistance or effective power.','Source behavior: the regression uses ITTC 1957; the displayed friction-line choice is recorded but does not change that regression.'],
        MT04:['Inputs: 3–6 complete, geometrically similar geosim model cases.','Applicability: model cases must have comparable Froude numbers and the required measured data.','Method: fits CT = a + b·CF; the workbook status checks model count and Froude-number spread.'],
        MT05:['Inputs: measured model-test data and the required model/ship geometry.','Method boundary: Schoenherr / ATTC friction-line extrapolation; it does not use a multi-model geosim regression.','Use: confirm the selected friction-line/allowance settings and review the returned status.'],
        MT06:['Inputs: measured model-test data, scale geometry, speed, and water properties.','Method boundary: ITTC 1957 correlation line, with the declared optional form-factor branch.','Use: do not supply a manual form factor unless it has a documented basis.'],
        MT07:['Inputs: measured model-test data and the method-specific full-scale correction inputs.','Method boundary: ITTC 1978 resistance extrapolation with form-factor, roughness, and allowance terms as configured.','Use: confirm each correction input has a documented basis; review the workbook status.'],
        MT08:['Method scope: historical Froude/friction comparison.','Limitations: retain the source warning for model/ship length and possible transitional flow at small model scale.','Use: treat as a historical comparator, not a universal replacement for current friction-line methods.']
      };
      const picker=installMethodCards(method,{label:'Model-test extrapolation methods',readNotes:()=>methodLimits[method?.value]||['Select the method and review its measured-data and applicability requirements.']});
      [document.getElementById('methoddesc'),document.getElementById('methodFootnote')].filter(Boolean).forEach(element=>element.classList.add('arus-method-source-hidden'));
    }
    if(moduleId==='interaction'){
      let family='all';
      const type=document.getElementById('typeSelect'),groups=document.getElementById('groupSelect');
      const typePicker=installMethodCards(type,{label:'Calculation type',note:['Wake fraction w and thrust deduction t are different coefficients.','Select one coefficient family; combined output is available only where the selected input group supports both.']});
      const groupPicker=installMethodCards(groups,{label:'Wake and thrust method/input groups',readNotes:()=>[document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText].filter(Boolean)});
      const syncInteraction=()=>{
        family=type?.value||'all';
        if(typePicker)typePicker.setLimitations(family==='wake'?['Coefficient: wake fraction w estimates inflow-velocity reduction.','Applicability: confirm the selected method’s source, required inputs, and vessel/operating domain.']:family==='thrust'?['Coefficient: thrust deduction t represents thrust interaction.','Applicability: confirm the selected method’s source, required inputs, and vessel/operating domain.']:['Wake fraction w and thrust deduction t are different coefficients.','Combined results are available only for input groups that explicitly support both.']);
        if(groupPicker){const member=document.getElementById('groupMembers')?.innerText?.trim(),help=document.getElementById('groupHelp')?.innerText?.trim();groupPicker.setLimitations([member&&`Included methods: ${member}`,help&&`Input-group guidance: ${help}`,'Applicability: verify the selected source method’s documented domain before using the coefficient.'].filter(Boolean));}
      };
      type?.addEventListener('change',syncInteraction);groups?.addEventListener('change',syncInteraction);syncInteraction();
    }
    if(moduleId==='interaction-grouped'){
      const group=document.getElementById('inputGroup'),picker=installMethodCards(group,{label:'Wake/thrust method input groups',readNotes:()=>[document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText].filter(Boolean).join(' ')});
      if(picker){const refresh=()=>{picker.setLimitations([document.getElementById('groupMembers')?.innerText,document.getElementById('groupHelp')?.innerText,'Applicability: finite results do not certify empirical suitability; verify the source-domain limits.'].filter(Boolean));};group?.addEventListener('change',refresh);refresh();}
    }
    if(moduleId==='selection'){
      const hint=document.querySelector('.method-hint');
      if(hint)hint.textContent='KT Ship — Inputs: vessel resistance and propeller diameter.\nKQ Power — Inputs: vessel speed, engine power and propeller RPM.\nScreening: check the selected propeller-series domain and cavitation criterion; this screen is not a full cavitation or clearance design review.';
    }
    if(moduleId==='model-test'){
      // Example measurements, clearly identified as examples; source equations are unchanged.
      const values={lambda:'20',lm:'4.5',sm:'6.5',volumeM:'1.5',tankH:'3',tankArea:'20',modelAx:'0.3'};
      for(const [id,value] of Object.entries(values)){const field=document.getElementById(id);if(field&&!field.value)field.value=value;}
      [[0.8,9.8808],[1,16.8241],[1.2,28.7288]].forEach(([speed,resistance],i)=>{
        for(const [column,value] of [['vm',speed],['rtm',resistance]]){const field=document.querySelector(`#runRows [data-r="${i}"][data-col="${column}"]`);if(field&&!field.value)field.value=String(value);}
      });
      [2.5,3.5,4.5].forEach((length,i)=>{
        const ratio=length/4.5,example={lm:length,vm:Math.sqrt(ratio),rtm:10*ratio**3,sm:6.5*ratio**2};
        for(const [column,value] of Object.entries(example)){const field=document.querySelector(`#geoRows [data-g="${i}"][data-col="${column}"]`);if(field&&!field.value)field.value=String(Number(value.toFixed(6)));}
      });
      const note=document.createElement('p');note.className='arus-example-note';note.textContent='Example model-test values are shown. Replace them with measured data before using the results.';document.querySelector('#runRows')?.closest('.panel')?.querySelector('.pbody')?.prepend(note);
      const initializedMethods=new Set(['MT01']);
      document.addEventListener('change',event=>{
        if(event.target.id!=='method'||initializedMethods.has(event.target.value))return;
        initializedMethods.add(event.target.value);
        const factor=document.getElementById('ffManual');
        if(factor&&!factor.value){factor.value='1.2';factor.dispatchEvent(new Event('input',{bubbles:true}));}
      });
      document.getElementById('lambda')?.dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(moduleId==='interaction-grouped'){
      const note=document.querySelector('.guidenote');
      if(note)note.textContent='A finite result means the equation can be evaluated; it does not certify method applicability. Review values outside 0 ≤ w,t < 1 and all method-specific limits.';
    }
    translatePage();
    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; translatePage(); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  });
  window.addEventListener('load', () => {
    if(moduleId==='performance'){
      const variant=document.getElementById('variant'),z=document.getElementById('z');
      const label=document.querySelector('label[for="variant"]');
      if(label)label.textContent='Blade count · Z';
      z?.closest('.field')?.classList.add('arus-internal-hidden');
      const sync=()=>{
        const models=window.ARUS_Module02_Test?.models;
        if(!models||!variant)return;
        const counts={};for(const option of variant.options){const m=models[option.value];if(m)counts[m.z]=(counts[m.z]||0)+1;}
        for(const option of variant.options){const m=models[option.value];if(!m)continue;
          // Each option retains its exact original model ID and native change handler.
          if(!option.dataset.originalLabel)option.dataset.originalLabel=option.textContent;
          const text=String(m.z)+(counts[m.z]>1?' — '+option.dataset.originalLabel:'');
          if(option.textContent!==text)option.textContent=text;
        }
      };
      sync();new MutationObserver(sync).observe(variant,{childList:true});
      const reWrap=document.getElementById('reWrap'),reCorrect=document.getElementById('reCorrect'),sourceRe=document.getElementById('reynolds');
      if(reWrap&&reCorrect&&sourceRe){
        sourceRe.closest('.field')?.classList.add('arus-internal-hidden');
        const grid=document.createElement('div');grid.className='arus-reynolds-grid';grid.setAttribute('aria-label','Inputs to calculate propeller Reynolds number');
        const addInput=(key,label,unit,value='')=>{
          const field=document.createElement('label');field.className='arus-re-field';field.htmlFor=`arus-re-${key}`;
          const title=document.createElement('span');title.textContent=label;
          const input=document.createElement('input');input.id=`arus-re-${key}`;input.type='number';input.step='any';input.inputMode='decimal';input.value=value;input.setAttribute('aria-label',label);
          const suffix=document.createElement('small');suffix.textContent=unit;
          field.append(title,input,suffix);grid.append(field);return input;
        };
        // Editable demonstration inputs, not recommended vessel/propeller dimensions.
        const va=addInput('va','Axial inflow velocity · Vₐ','m/s','5');
        const rpm=addInput('rpm','Propeller speed · n','rpm','120');
        const diameter=addInput('diameter','Propeller diameter · D','m','4');
        const chord=addInput('chord','Calculated blade chord at 0.75R · c₀.₇₅','m','');chord.readOnly=true;chord.setAttribute('aria-readonly','true');chord.tabIndex=-1;
        const viscosity=addInput('viscosity','Kinematic viscosity · ν','m²/s','0.0000011892');
        const resultField=document.createElement('label');resultField.className='arus-re-field arus-re-result';
        const resultTitle=document.createElement('span');resultTitle.textContent='Calculated Reynolds number · Re₀.₇₅';
        const result=document.createElement('output');result.id='arus-re-result';result.value='—';result.textContent='—';result.setAttribute('aria-live','polite');
        const resultUnit=document.createElement('small');resultUnit.textContent='dimensionless';resultField.append(resultTitle,result,resultUnit);grid.append(resultField);
        const note=document.createElement('p');note.className='arus-reynolds-note';note.textContent='Blade chord is calculated from B-Series geometry parameters: c₀.₇₅ = 2.057 · D · (AE/A₀) / Z. Reynolds number is derived automatically; check inflow, RPM, diameter and viscosity. Reynolds correction is optional.';
        const checkbox=reCorrect.closest('label');
        if(checkbox){checkbox.classList.add('arus-reynolds-toggle');checkbox.after(grid,note);}
        const fields=[va,rpm,diameter,chord,viscosity];const earInput=document.getElementById('ear'),bladeCountInput=document.getElementById('z');
        const formatRe=value=>Number.isFinite(value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value):'—';
        const recalculateRe=()=>{
          // Formula already used by the original B-Series KT-selection solver.
          const d0=Number(diameter.value),ae0=Number(earInput?.value),z0=Number(bladeCountInput?.value);
          const chordValue=Number.isFinite(d0)&&d0>0&&Number.isFinite(ae0)&&ae0>0&&Number.isFinite(z0)&&z0>0?2.057*d0*ae0/z0:NaN;
          chord.value=Number.isFinite(chordValue)?chordValue.toFixed(6):'';
          const raw=fields.map(field=>field.value.trim());
          const complete=raw.every(value=>value!=='');
          const [axial,shaftRpm,d,c,nu]=raw.map(Number);
          const valid=complete&&Number.isFinite(axial)&&axial>=0&&Number.isFinite(shaftRpm)&&shaftRpm>0&&Number.isFinite(d)&&d>0&&Number.isFinite(c)&&c>0&&Number.isFinite(nu)&&nu>0;
          const n=shaftRpm/60;
          const re=valid?c*Math.hypot(axial,0.75*Math.PI*n*d)/nu:NaN;
          sourceRe.value=valid?String(re):(reCorrect.checked?'':'2000000');
          result.value=formatRe(re);result.textContent=formatRe(re);
          if(!valid&&reCorrect.checked)note.dataset.invalid='true';else delete note.dataset.invalid;
          if(valid&&reCorrect.checked&&(re<2e6||re>2e9))note.dataset.outOfRange='true';else delete note.dataset.outOfRange;
          sourceRe.dispatchEvent(new Event('change',{bubbles:true}));
        };
        [va,rpm,diameter,viscosity,earInput,bladeCountInput].filter(Boolean).forEach(field=>{field.addEventListener('input',recalculateRe);field.addEventListener('change',recalculateRe);});
        reCorrect.addEventListener('change',recalculateRe);
        variant?.addEventListener('change',()=>setTimeout(recalculateRe,0));
        recalculateRe();
      }
    }
    if(moduleId==='resistance'){
      const note=document.createElement('p');note.className='arus-example-note';
      note.textContent='Example inputs are provided. Confirm method applicability and replace them with vessel data. Full workbook parity has not been established for every method.';
      document.getElementById('methodInfo')?.before(note);
      const json=document.getElementById('resultJson');
      json?.closest('details')?.classList.add('arus-internal-hidden');
      const heading=json?.closest('details')?.previousElementSibling;
      if(heading?.tagName==='H3')heading.classList.add('arus-internal-hidden');
      const vessel=document.getElementById('shipInputs');
      const syncHeading=()=>{
        // Detect actual native input controls, not layout visibility. A hidden
        // parent (workflow step / stale arus-empty-inputs) makes getClientRects()
        // zero even when all source fields have been generated.
        const visible=[...vessel.children].some(el=>el.classList?.contains('field')&&!!el.querySelector('input,select,textarea'));
        if(vessel.previousElementSibling)vessel.previousElementSibling.hidden=!visible;
        vessel.classList.toggle('arus-empty-inputs',!visible);
        vessel.parentElement.classList.toggle('arus-no-ship',!visible);
      };
      // The source asynchronously rebuilds fields after method changes. Recheck
      // when it adds/removes fields; do not depend on event ordering.
      syncHeading();
      new MutationObserver(syncHeading).observe(vessel,{childList:true,subtree:false});
      document.getElementById('method')?.addEventListener('change',()=>setTimeout(syncHeading,0));
    }
    if (moduleId === 'geometry') {
      const sidebar = document.getElementById('sidebar');
      const heading = document.createElement('h2');
      heading.className = 'arus-input-heading';
      heading.textContent = 'Design inputs';
      sidebar.prepend(heading);
      const hint = document.getElementById('viewHint');
      const container = document.getElementById('canvasContainer');
      container.before(hint);
      const station = document.getElementById('stationChoose');
      const sectionControl = document.createElement('label');
      sectionControl.id = 'arus-section-control';
      sectionControl.append(document.createTextNode('Radial station'));
      const sectionSelect = document.createElement('select');
      sectionSelect.setAttribute('aria-label', 'Section radial station');
      sectionControl.append(sectionSelect);
      document.querySelector('.viewer-controls').prepend(sectionControl);
      const syncStation = () => {
        sectionSelect.replaceChildren(...Array.from(station.options, option => new Option(option.text, option.value)));
        sectionSelect.value = station.value;
      };
      sectionSelect.addEventListener('change', () => { station.value = sectionSelect.value; station.dispatchEvent(new Event('change', { bubbles: true })); });
      new MutationObserver(syncStation).observe(station, { childList: true });
      station.addEventListener('change', syncStation);
      syncStation();
      const axes = document.querySelector('[data-layer="axes"]');
      if (axes?.checked) {
        axes.checked = false;
        axes.dispatchEvent(new Event('change', { bubbles: true }));
      }
      axes?.closest('label')?.remove();
    }
    {
      let lastHeight=0;
      const reportHeight=()=>{
        const root = moduleId === 'geometry'
          ? (document.querySelector('.app-shell') || document.body)
          : document.body;
        const rectBottom = root
          ? Math.ceil(root.getBoundingClientRect().bottom + (document.documentElement.scrollTop || document.body.scrollTop || 0))
          : 0;
        const height = moduleId === 'geometry'
          ? rectBottom
          : Math.max(rectBottom, Math.ceil(document.body.scrollHeight));
        if(height>=200&&height!==lastHeight){lastHeight=height;send('resize',{height});}
      };
      if(window.ResizeObserver){const observer=new ResizeObserver(()=>requestAnimationFrame(reportHeight));observer.observe(document.documentElement);observer.observe(document.body);}
      if(window.MutationObserver){const contentObserver=new MutationObserver(()=>requestAnimationFrame(reportHeight));contentObserver.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});}
      window.addEventListener('load',reportHeight,{once:true});
      window.addEventListener('resize',reportHeight);
      requestAnimationFrame(reportHeight);
    }
    send('ready');
  });
})();
