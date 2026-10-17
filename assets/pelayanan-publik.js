(function(){
  'use strict';
  const sb=window.DAWUNG_SUPABASE;
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const params=new URLSearchParams(location.search);
  const requestedType=params.get('jenis')||'surat_pengantar';
  const services={
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
  const type=Object.prototype.hasOwnProperty.call(services,requestedType)?requestedType:'surat_pengantar';
  const common=[
    ['pemohon_nama','Nama Lengkap','text','Nama sesuai identitas',''],
    ['nik','NIK','text','16 digit NIK',''],
    ['tempat_lahir','Tempat Lahir','text','Kota/kabupaten tempat lahir',''],
    ['tanggal_lahir','Tanggal Lahir','date','', ''],
    ['jenis_kelamin','Jenis Kelamin','select','', '', ['Laki-laki','Perempuan']],
    ['alamat','Alamat','textarea','Alamat tempat tinggal','full'],
    ['rt_rw','RT / RW','text','Contoh: RT 04 / RW 01',''],
    ['no_hp','No. HP / WhatsApp','tel','Nomor yang dapat dihubungi','']
  ];
  const cfg=services[type];
  $('#pageTitle').textContent=cfg.title;
  $('#pageDesc').textContent=cfg.desc;
  function fieldHtml(f,required=false){
    const [name,label,inputType,placeholder,span,opts]=f;
    const req=required?'required':'';
    const mark=required?'<span class="required">*</span>':'';
    if(inputType==='textarea')return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${mark}</label><textarea id="${name}" name="${name}" placeholder="${esc(placeholder||'')}" ${req}></textarea></div>`;
    if(inputType==='select')return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${mark}</label><select id="${name}" name="${name}" ${req}><option value="">Pilih...</option>${(opts||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>`;
    if(inputType==='date'){
      const currentYear=new Date().getFullYear();
      const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      return `<div class="form-field ${span==='full'?'full':''} date-field"><label>${label} ${mark}</label><input type="hidden" id="${name}" name="${name}" value=""><div class="date-parts" data-field="${name}"><div class="date-part"><label for="${name}_day">Tanggal</label><select id="${name}_day" aria-label="Tanggal lahir"><option value="">Tgl</option>${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></div><div class="date-part"><label for="${name}_month">Bulan</label><select id="${name}_month" aria-label="Bulan lahir"><option value="">Pilih bulan</option>${months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div><div class="date-part"><label for="${name}_year">Tahun</label><select id="${name}_year" aria-label="Tahun lahir"><option value="">Tahun</option>${Array.from({length:currentYear-1900+1},(_,i)=>currentYear-i).map(y=>`<option value="${y}">${y}</option>`).join('')}</select></div></div><small class="date-helper">Pilih tanggal, bulan, dan tahun lahir. Kolom ini boleh dikosongkan jika tidak diperlukan.</small></div>`;
    }
    return `<div class="form-field ${span==='full'?'full':''}"><label for="${name}">${label} ${mark}</label><input id="${name}" name="${name}" type="${inputType}" placeholder="${esc(placeholder||'')}" ${inputType==='text'&&name==='nik'?'inputmode="numeric" maxlength="16"':''} ${req}></div>`;
  }
  $('#formArea').innerHTML=`<form id="publicServiceForm"><div class="form-grid"><div class="section-title"><b>Data Pemohon</b></div>${common.map((f,i)=>fieldHtml(f,[0,1,5,7].includes(i))).join('')}<div class="section-title"><b>Detail Pengajuan</b></div>${cfg.fields.map(f=>fieldHtml(f,['keperluan','nama_usaha','alamat_usaha','lokasi_laporan','kronologi','judul_aspirasi','isi_aspirasi'].includes(f[0]))).join('')}</div><div class="notice info">NIK digunakan sebagai identitas pemohon. <b>No. KK tidak diperlukan.</b></div><div class="actions"><button class="btn premium-submit" id="submitBtn" type="submit"><span>Kirim Pengajuan</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button><a class="back-link premium-lookup" href="cek-pengajuan.html">Sudah punya kode? Cek Pengajuan <span aria-hidden="true">↗</span></a></div></form>`;

  // Keep the stored value compatible with the existing YYYY-MM-DD date format,
  // while letting users choose day, month, and year separately.
  document.querySelectorAll('.date-parts').forEach(parts=>{
    const name=parts.dataset.field;
    const day=parts.querySelector(`#${name}_day`);
    const month=parts.querySelector(`#${name}_month`);
    const year=parts.querySelector(`#${name}_year`);
    const hidden=document.getElementById(name);
    const pad=n=>String(n).padStart(2,'0');
    function updateDateParts(){
      const m=Number(month.value), y=Number(year.value), previous=day.value;
      let maxDays=31;
      if(m){
        if(m===2) maxDays=y ? (new Date(y,1,29).getMonth()===1?29:28) : 29;
        else if([4,6,9,11].includes(m)) maxDays=30;
      }
      day.innerHTML='<option value="">Tgl</option>'+Array.from({length:maxDays},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
      if(previous && Number(previous)<=maxDays) day.value=previous;
      const any=Boolean(day.value||month.value||year.value);
      const complete=Boolean(day.value&&month.value&&year.value);
      hidden.value=complete?`${year.value}-${pad(month.value)}-${pad(day.value)}`:'';
      parts.dataset.partial=any&&!complete?'true':'false';
    }
    [day,month,year].forEach(el=>el.addEventListener('change',updateDateParts));
    updateDateParts();
  });

  let submitting=false;
  $('#publicServiceForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(submitting)return;
    const btn=$('#submitBtn');
    if(!sb){$('#notice').innerHTML='<div class="notice error">Layanan belum terhubung ke server. Silakan coba lagi nanti.</div>';return;}
    const fd=new FormData(e.currentTarget),data={};
    fd.forEach((v,k)=>data[k]=String(v).trim());
    const partialDate=document.querySelector('.date-parts[data-partial="true"]');
    if(partialDate){
      $('#notice').innerHTML='<div class="notice error">Untuk tanggal lahir, silakan pilih tanggal, bulan, dan tahun secara lengkap, atau kosongkan semuanya.</div>';
      partialDate.querySelector('select:invalid')?.focus();
      (partialDate.querySelector('select')||partialDate).focus?.();
      return;
    }
    const required=['pemohon_nama','nik','alamat','no_hp'];
    if(cfg.fields.some(f=>f[0]==='keperluan'))required.push('keperluan');
    if(type==='usaha')required.push('nama_usaha','alamat_usaha');
    if(type==='laporan')required.push('lokasi_laporan','kronologi');
    if(type==='aspirasi')required.push('judul_aspirasi','isi_aspirasi');
    if(!/^\d{16}$/.test(data.nik||'')){$('#notice').innerHTML='<div class="notice error">NIK harus terdiri dari 16 digit.</div>';return;}
    if(required.some(k=>!data[k])){$('#notice').innerHTML='<div class="notice error">Mohon lengkapi semua kolom yang bertanda wajib.</div>';return;}
    submitting=true;btn.disabled=true;btn.innerHTML='<span>Mengirim...</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/></svg>';btn.style.pointerEvents='none';
    $('#notice').innerHTML='';
    try{
      const payload={warga_id:null,pemohon_nama:data.pemohon_nama,jenis:type,keperluan:data.keperluan||data.isi_aspirasi||data.kronologi||'',data_form:data};
      const {data:row,error}=await sb.from('surat_pengajuan').insert(payload).select('kode_pengajuan').single();
      if(error)throw error;
      const code=row?.kode_pengajuan;
      if(!code)throw new Error('Kode pengajuan belum terbentuk.');
      $('#formArea').innerHTML=`<div class="success"><small>PENGAJUAN BERHASIL</small><h2>Terima kasih, ${esc(data.pemohon_nama)}.</h2><p>Simpan kode berikut untuk mengecek perkembangan pengajuan Anda.</p><div class="code-box" id="codeBox">${esc(code)}</div><div class="actions"><button class="btn premium-submit" id="copyCode" type="button"><span>Salin Kode</span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg></button><a class="back-link premium-lookup" href="cek-pengajuan.html">Cek Status <span aria-hidden="true">↗</span></a><a class="back-link premium-back" href="index.html"><span class="premium-button-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 5 7.5 12l7 7"/><path d="M8 12h12"/></svg></span><span>Kembali ke Website</span></a></div></div>`;
      $('#copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('#copyCode').innerHTML='<span>Kode Tersalin</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';}catch(_){alert('Kode: '+code)}};
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(error){
      console.error('[Pelayanan Publik]',error);
      submitting=false;btn.disabled=false;btn.innerHTML='<span>Kirim Pengajuan</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>';btn.style.pointerEvents='';
      $('#notice').innerHTML='<div class="notice error">Pengajuan belum dapat dikirim. '+esc(error?.message||'Periksa koneksi atau konfigurasi pelayanan.')+'</div>';
    }
  });
})();
