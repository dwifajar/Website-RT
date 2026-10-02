(function(){
  const sb = window.DAWUNG_SUPABASE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const params = new URLSearchParams(location.search);
  const type = params.get('jenis') || 'surat_pengantar';

  const services = {
    surat_pengantar:{title:'Surat Pengantar',desc:'Ajukan surat pengantar untuk kebutuhan administrasi Anda.',fields:[
      ['tujuan_surat','Tujuan Surat','text','Contoh: Desa/Kelurahan, sekolah, bank, instansi','full'],
      ['keperluan','Keperluan','textarea','Jelaskan kebutuhan surat secara singkat','full']
    ]},
    domisili:{title:'Surat Keterangan Domisili',desc:'Lengkapi data tempat tinggal untuk pengajuan surat domisili.',fields:[
      ['alamat_domisili','Alamat Domisili','textarea','Alamat tempat tinggal saat ini','full'],
      ['lama_tinggal','Lama Tinggal','text','Contoh: 5 tahun'],
      ['status_tinggal','Status Tinggal','select','',null,['Milik sendiri','Kontrak','Menumpang','Lainnya']],
      ['keperluan','Keperluan','textarea','Keperluan surat domisili','full']
    ]},
    lainnya:{title:'Surat Keterangan',desc:'Pilih jenis keterangan yang Anda perlukan.',fields:[
      ['subjenis','Jenis Keterangan','select','',null,['Tidak Mampu (SKTM)','Belum Menikah','Keterangan Lainnya']],
      ['keperluan','Keperluan','textarea','Jelaskan keperluan surat','full']
    ]},
    usaha:{title:'Surat Keterangan Usaha',desc:'Lengkapi informasi usaha untuk pengajuan surat.',fields:[
      ['nama_usaha','Nama Usaha','text','Nama usaha','full'],
      ['jenis_usaha','Jenis Usaha','text','Contoh: warung, pertanian, jasa'],
      ['lama_usaha','Lama Usaha','text','Contoh: 3 tahun'],
      ['alamat_usaha','Alamat Usaha','textarea','Alamat lokasi usaha','full'],
      ['keperluan','Keperluan','textarea','Keperluan surat usaha','full']
    ]},
    laporan:{title:'Lapor Lingkungan',desc:'Sampaikan laporan masalah lingkungan kepada pengurus RT.',fields:[
      ['kategori_laporan','Kategori','select','',null,['Kebersihan','Keamanan','Infrastruktur','Penerangan','Fasilitas Umum','Lainnya']],
      ['tingkat_urgensi','Urgensi','select','',null,['Biasa','Penting','Mendesak']],
      ['lokasi_laporan','Lokasi','text','Lokasi masalah','full'],
      ['kronologi','Kronologi / Laporan','textarea','Jelaskan masalah yang terjadi','full']
    ]},
    aspirasi:{title:'Aspirasi Warga',desc:'Sampaikan saran, ide, atau masukan untuk kemajuan lingkungan RT.',fields:[
      ['kategori_aspirasi','Kategori','select','',null,['Lingkungan','Kegiatan Warga','Pelayanan RT','Keamanan','Kebersihan','Lainnya']],
      ['judul_aspirasi','Judul','text','Ringkas judul aspirasi','full'],
      ['isi_aspirasi','Isi Aspirasi','textarea','Tuliskan saran atau masukan Anda','full']
    ]}
  };

  const common = [
    ['pemohon_nama','Nama Lengkap','text','Nama sesuai identitas',''],
    ['nik','NIK','text','16 digit NIK',''],
    ['tempat_lahir','Tempat Lahir','text','Kota/kabupaten tempat lahir',''],
    ['tanggal_lahir','Tanggal Lahir','date','', ''],
    ['jenis_kelamin','Jenis Kelamin','select','', '', ['Laki-laki','Perempuan']],
    ['alamat','Alamat','textarea','Alamat tempat tinggal','full'],
    ['rt_rw','RT / RW','text','Contoh: RT 04 / RW 01',''],
    ['no_hp','No. HP / WhatsApp','tel','Nomor yang dapat dihubungi','']
  ];

  const cfg = services[type] || services.surat_pengantar;
  $('#pageTitle').textContent = cfg.title;
  $('#pageDesc').textContent = cfg.desc;

  function fieldHtml(f, required=false){
    const [name,label,type,placeholder,span,opts] = f;
    const req = required ? '<span class="required">*</span>' : '';
    if(type==='textarea') return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${req}</label><textarea id="${name}" name="${name}" placeholder="${esc(placeholder||'')}"></textarea></div>`;
    if(type==='select') return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${req}</label><select id="${name}" name="${name}"><option value="">Pilih...</option>${(opts||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>`;
    return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${req}</label><input id="${name}" name="${name}" type="${type}" placeholder="${esc(placeholder||'')}" ${type==='text'&&name==='nik'?'inputmode="numeric" maxlength="16"':''}></div>`;
  }

  $('#formArea').innerHTML = `
    <form id="publicServiceForm">
      <div class="form-grid">
        <div class="section-title"><b>Data Pemohon</b></div>
        ${common.map((f,i)=>fieldHtml(f, [0,1,5,7].includes(i))).join('')}
        <div class="section-title"><b>Detail Pengajuan</b></div>
        ${cfg.fields.map(f=>fieldHtml(f, ['keperluan','nama_usaha','alamat_usaha','lokasi_laporan','kronologi','judul_aspirasi','isi_aspirasi'].includes(f[0]))).join('')}
      </div>
      <div class="notice info">NIK digunakan sebagai identitas pemohon. <b>No. KK tidak diperlukan.</b></div>
      <div class="actions"><button class="btn green" id="submitBtn" type="submit">Kirim Pengajuan</button><a class="back-link" href="cek-pengajuan.html">Sudah punya kode? Cek Pengajuan</a></div>
    </form>`;

  $('#publicServiceForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const btn=$('#submitBtn'); btn.disabled=true; btn.textContent='Mengirim...';
    $('#notice').innerHTML='';
    const fd=new FormData(e.currentTarget);
    const data={};
    fd.forEach((v,k)=>data[k]=String(v).trim());
    if(!/^\d{16}$/.test(data.nik||'')){ $('#notice').innerHTML='<div class="notice error">NIK harus terdiri dari 16 digit.</div>'; btn.disabled=false;btn.textContent='Kirim Pengajuan';return; }
    const required=['pemohon_nama','nik','alamat'];
    if(cfg.fields.some(f=>f[0]==='keperluan')) required.push('keperluan');
    if(type==='usaha') required.push('nama_usaha','alamat_usaha');
    if(type==='laporan') required.push('lokasi_laporan','kronologi');
    if(type==='aspirasi') required.push('judul_aspirasi','isi_aspirasi');
    const missing=required.find(k=>!data[k]);
    if(missing){ $('#notice').innerHTML='<div class="notice error">Mohon lengkapi semua kolom yang bertanda wajib.</div>'; btn.disabled=false;btn.textContent='Kirim Pengajuan';return; }

    const payload={
      warga_id:null,
      pemohon_nama:data.pemohon_nama,
      jenis:type,
      keperluan:data.keperluan || data.isi_aspirasi || data.kronologi || '',
      data_form:data
    };
    const {data:row,error}=await sb.from('surat_pengajuan').insert(payload).select('kode_pengajuan').single();
    if(error){
      console.error(error);
      $('#notice').innerHTML='<div class="notice error">Pengajuan belum dapat dikirim. Periksa koneksi atau konfigurasi Supabase.</div>';
      btn.disabled=false;btn.textContent='Kirim Pengajuan';return;
    }
    const code=row?.kode_pengajuan||'-';
    $('#formArea').innerHTML=`<div class="success"><small>PENGAJUAN BERHASIL</small><h2>Terima kasih, ${esc(data.pemohon_nama)}.</h2><p>Simpan kode berikut untuk mengecek perkembangan pengajuan Anda.</p><div class="code-box" id="codeBox">${esc(code)}</div><div class="actions"><button class="btn green" id="copyCode">Salin Kode</button><a class="back-link" href="cek-pengajuan.html">Cek Status</a><a class="back-link" href="index.html">Kembali ke Website</a></div></div>`;
    $('#copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('#copyCode').textContent='Kode Tersalin ✓';}catch(_){alert('Kode: '+code)}};
    window.scrollTo({top:0,behavior:'smooth'});
  });
})();