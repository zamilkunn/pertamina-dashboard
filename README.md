# 🧭 Pertamina Career-Sync: Internship 2026 Dashboard & AI Matcher

**Pertamina Career-Sync** adalah platform dashboard analitik interaktif berbasis web modern yang dirancang khusus untuk memetakan, menganalisis, dan membandingkan seluruh program magang **PT Pertamina (Persero) Tahun 2026** secara real-time. 

Web ini dilengkapi dengan **Recommender System** cerdas bertenaga AI yang membantu pelamar mengunggah CV mereka, mendeteksi kecenderungan rumpun keahlian secara otomatis, dan menyajikan rekomendasi lowongan magang yang paling sesuai dengan peluang masuk terbesar.

---

## 📖 Penjelasan Detail Halaman & Cara Kerja Web

Dashboard ini dibagi menjadi 4 halaman utama yang dapat diakses secara instan melalui sidebar navigasi kiri:

### 1. 📊 Halaman Analytics Dashboard (Internship Analytics)
Halaman awal untuk melihat peta persaingan magang secara makro:
*   **KPI Summary Widgets**: Menampilkan data agregat total lowongan magang aktif, jumlah posisi kuota yang dibuka, total seluruh pelamar, rata-rata rasio keketatan, serta sorotan khusus untuk lowongan dengan persaingan paling sengit.
*   **Visual Chart Panel**: Menggunakan **Chart.js** untuk menyajikan visualisasi data yang responsif:
    *   *Chart Polar Area (Rumpun Fungsi)*: Distribusi bidang keahlian magang (seperti HSSE, Keuangan, Hukum, Teknologi Informasi, dll.).
    *   *Chart Doughnut (Persentase Kuota)*: Perbandingan jatah kuota anak perusahaan.
    *   *Chart Bar (Perbandingan Pelamar)*: Jumlah pendaftar per anak perusahaan (seperti PT Pertamina Hulu Energi, PT Pertamina Patra Niaga, PT Kilang Pertamina Internasional, dll.) guna mempermudah pencarian anak perusahaan dengan persaingan terendah.

### 2. 🔍 Halaman Program Explorer
Pusat pencarian dan penelusuran lowongan magang secara mikro:
*   **Live Search Box**: Ketik posisi magang yang dicari untuk menyaring data secara instan di layar.
*   **Multi-Filter Options**: Saring lowongan berdasarkan nama anak perusahaan Pertamina, lokasi geografis (seperti Jakarta Selatan, Balikpapan, Palembang, dll.), serta rasio persaingan (Sangat Ketat vs Peluang Tinggi).
*   **Visual Grid & List Toggle**: Pilih tampilan grid visual yang premium atau daftar tabel terstruktur.
*   **Bookmark Toggle**: Tandai posisi magang yang Anda minati dengan sekali klik untuk dimasukkan ke daftar perbandingan.

### 3. 🧠 Halaman AI CV Matcher (Fitur Unggulan)
Sistem pencocok CV bertenaga AI yang interaktif:
*   **Client-Side PDF Reader**: Seret dan lepaskan (drag & drop) file CV Anda dalam format PDF atau TXT. Sistem menggunakan `pdf.js` untuk mengekstrak isi teks CV Anda secara lokal di browser demi keamanan data pribadi.
*   **Auto-Classifier**: AI mendeteksi rumpun bidang keahlian Anda (seperti IT, HR, Keuangan, HSSE, dsb.) secara otomatis dan memunculkan badge kata kunci (keyword) yang cocok.
*   **Llama 3.3 (Groq API)** & **Gemini 1.5 Flash**: Mengirim teks CV ke LLM untuk mencocokkan keahlian Anda dengan lowongan yang memiliki rasio persaingan menguntungkan.
*   **AI Justification**: Menyajikan persentase kecocokan beserta ulasan analitis tertulis dalam Bahasa Indonesia mengenai mengapa kualifikasi Anda cocok dengan posisi tersebut dan **tips konkret sukses melamar**.

### 4. 🔖 Halaman My Saved List (Side-by-Side Comparator)
Workspace khusus untuk membandingkan opsi magang terpilih:
*   Menyandingkan posisi magang yang sudah Anda bookmark secara sejajar.
*   Menampilkan visualisasi statistik perbandingan kuota vs jumlah pendaftar saat ini.
*   Membantu Anda mengambil keputusan rasional untuk memilih lowongan yang paling menjamin peluang diterima terbesar.

---

## 🛠️ Tech Stack & Arsitektur

*   **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 Variables (Modern Light-Theme Default, Translucent Glassmorphism, Fluid Transitions, dan Ripple Click Effects).
*   **API Gateway & Security Proxy**: 
    *   `Vite configureServer Middleware` (Lokal) & `Vercel Serverless Functions` (Production).
    *   Melindungi API Key Anda agar tidak terekspos di browser lewat server-side proxy `/api/match`.
    *   **Hotlink CORS Guard**: Hanya menerima request dari `localhost` dan domain deployment Vercel Anda sendiri.
    *   **Anti-Spam Size Cap**: Membatasi input CV maksimal 15.000 karakter guna melindungi API key dari tagihan berlebih atau kehabisan limit harian.
*   **Dependency Libraries**: Lucide Icons, Chart.js, PDF.js.

---

## 🚀 Instalasi di Komputer Lokal

1.  Pastikan Anda telah menginstal **Node.js** (Versi 18+).
2.  Clone / unduh repositori ini ke komputer Anda.
3.  Masuk ke direktori dan install modul node:
    ```bash
    npm install
    ```
4.  Buka file [`.env`](file:///c:/Users/angga/Downloads/Scrap/.env) di root folder Anda dan ganti nilainya dengan API Key Groq Anda:
    ```env
    GROQ_API_KEY=gsk_IsiDenganKeyGroqAnda
    ```
5.  Jalankan server pengembangan:
    ```bash
    npm run dev
    ```
6.  Buka browser di alamat [http://localhost:3000](http://localhost:3000).

---

## ☁️ Langkah Menyebarkan (Deployment) ke Vercel

1.  Unggah repositori Anda ke GitHub (file `.env` otomatis diabaikan karena dilindungi oleh file `.gitignore`).
2.  Masuk ke dashboard **Vercel** dan impor repositori GitHub tersebut.
3.  Di pengaturan proyek, tambahkan **Environment Variable**:
    *   **Key**: `GROQ_API_KEY`
    *   **Value**: *[Salin API key Groq Anda yang diawali gsk_]*
4.  Klik **Deploy**! Website Anda akan langsung aktif di domain publik secara aman dan gratis.

---

## 📄 Hak Cipta & Kontribusi
Aplikasi ini dikembangkan oleh **Muhamad Cep Zamil**. Silakan digunakan dan disesuaikan untuk kebutuhan persiapan karier Anda!
