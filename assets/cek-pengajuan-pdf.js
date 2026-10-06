(function(){
  'use strict';

  const sb = window.DAWUNG_SUPABASE;
  const result = document.getElementById('result');
  const form = document.getElementById('checkForm');
  const codeInput = document.getElementById('kode');
  const labels = {menunggu:'Menunggu',diproses:'Diproses',selesai:'Selesai',ditolak:'Ditolak'};
  const downloadableTypes = new Set(['surat_pengantar','domisili','usaha','lainnya']);
  const serviceTitles = {
    surat_pengantar:'Surat Pengantar',
    domisili:'Surat Keterangan Domisili',
    usaha:'Surat Keterangan Usaha',
    lainnya:'Surat Keterangan'
  };
  let checking=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safe=s=>String(s??'').trim();

  function formData(x){
    const candidates=[x?.data_form,x?.dataForm,x?.form_data,x?.formData,x?.data?.data_form,x?.data?.form_data,x?.detail_form,x?.detail];
    for(const v of candidates){
      if(v && typeof v==='object') return v;
      if(typeof v==='string'){
        try{const parsed=JSON.parse(v);if(parsed&&typeof parsed==='object')return parsed;}catch(_){}}
    }
    return {};
  }

  function mergeDeep(base,extra){
    const out={...(base||{})};
    if(!extra||typeof extra!=='object')return out;
    for(const [k,v] of Object.entries(extra)){
      if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])) out[k]=mergeDeep(out[k],v);
      else if(v!==undefined&&v!==null&&safe(v)!=='') out[k]=v;
    }
    return out;
  }

  function flattenObject(value,out={},depth=0){
    if(depth>5||value===null||value===undefined)return out;
    if(Array.isArray(value)){value.forEach(v=>flattenObject(v,out,depth+1));return out;}
    if(typeof value!=='object')return out;
    for(const [k,v] of Object.entries(value)){
      if(v&&typeof v==='object') flattenObject(v,out,depth+1);
      else if(v!==undefined&&v!==null&&safe(v)!=='') out[k]=v;
    }
    return out;
  }

  function keyNorm(k){return safe(k).toLowerCase().replace(/[^a-z0-9]+/g,'');}

  function pick(obj,aliases,fallback=''){
    const flat=flattenObject(obj||{});
    const index={};
    Object.entries(flat).forEach(([k,v])=>{index[keyNorm(k)]=v;});
    for(const a of aliases){const v=index[keyNorm(a)];if(v!==undefined&&safe(v)!=='')return v;}
    return fallback;
  }

  function richData(x){
    const f=formData(x);
    return mergeDeep(x||{},f);
  }

  function prettyDate(v){
    if(!v)return '-';
    const s=safe(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
      const d=new Date(s+'T00:00:00');
      return Number.isNaN(d.getTime())?s:d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
    }
    const d=new Date(v);
    if(Number.isNaN(d.getTime()))return s;
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  }

  function typeLabel(x){
    const f=richData(x);
    if(x?.jenis==='lainnya' && safe(f.subjenis||f.jenis_keterangan)) return `Surat Keterangan - ${safe(f.subjenis||f.jenis_keterangan)}`;
    return serviceTitles[x?.jenis]||x?.jenis_label||x?.jenis||'Surat Keterangan';
  }

  function canonicalPayload(x){
    return {
      kode_pengajuan:safe(x?.kode_pengajuan),nomor_surat:safe(x?.nomor_surat),jenis:safe(x?.jenis),
      jenis_label:safe(x?.jenis_label),pemohon_nama:safe(x?.pemohon_nama),status:safe(x?.status),
      tanggal_pengajuan:safe(x?.tanggal_pengajuan),catatan_admin:safe(x?.catatan_admin||x?.catatan),data_form:formData(x)
    };
  }

  function stableStringify(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
  }

  async function sha256(text){
    if(!window.crypto?.subtle)throw new Error('Browser tidak mendukung verifikasi dokumen aman.');
    const bytes=new TextEncoder().encode(text);
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function documentHash(x){return sha256(stableStringify(canonicalPayload(x)));}

  function verificationUrl(hash,kode){
    const u=new URL('cek-pengajuan.html',window.location.href);
    u.searchParams.set('kode',kode);u.searchParams.set('verifikasi','1');u.searchParams.set('hash',hash);return u.toString();
  }

  async function loadPdfLibs(){
    if(window.jspdf?.jsPDF&&window.QRCode)return;
    throw new Error('Library PDF/QR belum termuat. Muat ulang halaman lalu coba lagi.');
  }

  async function makeQrDataUrl(text){
    if(!window.QRCode)throw new Error('Library QR belum termuat.');
    const host=document.createElement('div');
    host.style.position='fixed';host.style.left='-99999px';host.style.top='-99999px';host.style.width='180px';host.style.height='180px';
    document.body.appendChild(host);
    try{
      new QRCode(host,{text,width:180,height:180,colorDark:'#111111',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      await new Promise(r=>setTimeout(r,180));
      const canvas=host.querySelector('canvas');if(canvas)return canvas.toDataURL('image/png');
      const img=host.querySelector('img');if(img){if(!img.complete)await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;});return img.src;}
      throw new Error('QR tidak berhasil dibuat.');
    }finally{host.remove();}
  }

  async function getPdfData(kode,fallback){
    try{
      if(sb){
        const {data,error}=await sb.rpc('get_pengajuan_pdf',{p_kode:kode});
        if(!error&&data){
          const obj=Array.isArray(data)?(data[0]||{}):data;
          if(obj&&typeof obj==='object') return mergeDeep(fallback,obj);
        }
      }
    }catch(err){console.warn('[PDF] get_pengajuan_pdf:',err);}
    return fallback;
  }

  function getPerson(x){
    const f=richData(x);
    return {
      nama:safe(pick(f,['pemohon_nama','nama','nama_pemohon'],x?.pemohon_nama||'-')),
      nik:safe(pick(f,['nik','NIK','nomor_induk_kependudukan'], '-')),
      tempat_lahir:safe(pick(f,['tempat_lahir','tempat lahir','tempatLahir'],'-')),
      tanggal_lahir:safe(pick(f,['tanggal_lahir','tanggal lahir','tanggalLahir'],'-')),
      jenis_kelamin:safe(pick(f,['jenis_kelamin','jenis kelamin','jenisKelamin'],'-')),
      alamat:safe(pick(f,['alamat','alamat_rumah','alamat_domisili','alamat tinggal'],'-')),
      rt_rw:safe(pick(f,['rt_rw','RT/RW','rt rw'],'RT 04 / RW 01')),
      agama:safe(pick(f,['agama'],''))
    };
  }

  function gender(v){
    const t=safe(v).toLowerCase();
    if(['l','laki-laki','laki laki','male'].includes(t))return'Laki-laki';
    if(['p','perempuan','female'].includes(t))return'Perempuan';
    return safe(v)||'-';
  }

  function pdfTitle(x){
    if(x?.jenis==='surat_pengantar')return'SURAT PENGANTAR';
    if(x?.jenis==='domisili')return'SURAT KETERANGAN DOMISILI';
    if(x?.jenis==='usaha')return'SURAT KETERANGAN USAHA';
    return'SURAT KETERANGAN';
  }

  function text(doc,text,x,y,w,size=10,bold=false,align){
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(30,30,30);
    const lines=doc.splitTextToSize(safe(text)||'-',w);
    doc.text(lines,x,y,align?{align}:undefined);return y+lines.length*(size*0.50);
  }

  function field(doc,label,value,y){
    const x=24,labelX=24,valueX=62,w=124;
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(30,30,30);
    doc.text(label,x,y);doc.text(':',55,y);
    const lines=doc.splitTextToSize(safe(value)||'-',w);
    doc.text(lines,valueX,y);return y+Math.max(5.2,lines.length*5.2);
  }

  function signature(doc,issueDate,qr){
    const sigCX=145, sigY=228;
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(30,30,30);
    doc.text('Dawung, '+issueDate,sigCX,sigY,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Ketua RT 04 / RW 01',sigCX,sigY+6,{align:'center'});
    doc.setDrawColor(60,60,60);doc.setLineWidth(0.25);doc.line(118,sigY+30,168,sigY+30);
    doc.setFontSize(8);doc.setTextColor(80,80,80);doc.text('Tanda tangan / stempel Ketua RT',sigCX,sigY+35,{align:'center'});

    doc.addImage(qr,'PNG',174,219,24,24);
    doc.setFont('helvetica','bold');doc.setFontSize(7.2);doc.setTextColor(25,25,25);doc.text('QR VERIFIKASI',186,247,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.2);doc.setTextColor(75,75,75);
    doc.text(['Pindai untuk memeriksa','keaslian data dokumen.'],186,251,{align:'center'});
  }

  function specificParagraphs(x,p){
    const f=richData(x),out=[];
    if(x.jenis==='surat_pengantar'){
      out.push(`Yang bersangkutan adalah warga Dusun Dawung RT 04 / RW 01 dan memerlukan surat pengantar untuk ${safe(pick(f,['tujuan_surat','tujuan surat','tujuan'],'-'))}.`);
      out.push(`Adapun keperluan surat ini adalah ${safe(pick(f,['keperluan','keperluan surat'],'-'))}.`);
    }else if(x.jenis==='domisili'){
      out.push(`Yang bersangkutan benar berdomisili di ${safe(pick(f,['alamat_domisili','alamat domisili'],'')||p.alamat||'-')}, telah tinggal selama ${safe(pick(f,['lama_tinggal','lama tinggal'],'-'))}, dengan status tempat tinggal ${safe(pick(f,['status_tinggal','status tinggal'],'-'))}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${safe(pick(f,['keperluan','keperluan surat'],'-'))}.`);
    }else if(x.jenis==='usaha'){
      out.push(`Yang bersangkutan benar menjalankan usaha ${safe(pick(f,['nama_usaha','nama usaha'],'-'))} dengan jenis usaha ${safe(pick(f,['jenis_usaha','jenis usaha'],'-'))}, telah berjalan selama ${safe(pick(f,['lama_usaha','lama usaha'],'-'))}, dan beralamat di ${safe(pick(f,['alamat_usaha','alamat usaha'],'')||p.alamat||'-')}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${safe(pick(f,['keperluan','keperluan surat'],'-'))}.`);
    }else{
      out.push(`Yang bersangkutan memerlukan surat keterangan mengenai ${safe(pick(f,['subjenis','jenis_keterangan','jenis keterangan'],'keperluan yang diajukan'))}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${safe(pick(f,['keperluan','keperluan surat'],'-'))}.`);
    }
    return out;
  }

  async function downloadPdf(input){
    const x=await getPdfData(safe(input.kode_pengajuan).toUpperCase(),input);
    if(x.status!=='selesai')throw new Error('Surat baru dapat diunduh setelah status Selesai.');
    if(!downloadableTypes.has(x.jenis))throw new Error('Jenis pengajuan ini belum memiliki template PDF.');
    if(!safe(x.nomor_surat))throw new Error('Nomor surat belum tersedia.');
    await loadPdfLibs();

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,H=297,M=20,CW=W-2*M;
    const p=getPerson(x),title=pdfTitle(x),hash=await documentHash(x),verify=verificationUrl(hash,x.kode_pengajuan),qr=await makeQrDataUrl(verify);
    const issueDate=prettyDate(x.updated_at||x.tanggal_pengajuan||x.created_at);

    // Gaya mengikuti contoh surat resmi yang diberikan pengguna:
    // kop tengah, garis, judul bergaris bawah, identitas linear, narasi, tanda tangan kanan.
    doc.setFont('helvetica','normal');doc.setTextColor(25,25,25);
    doc.setFontSize(15);doc.setFont('helvetica','bold');doc.text('DUSUN DAWUNG',W/2,20,{align:'center'});
    doc.setFontSize(12);doc.text('RT 04 / RW 01',W/2,27,{align:'center'});
    doc.setFont('helvetica','italic');doc.setFontSize(9);doc.text('"Sepi Ing Pamrih, Rame Ing Gawe"',W/2,33,{align:'center'});
    doc.setDrawColor(20,20,20);doc.setLineWidth(0.55);doc.line(18,39,W-18,39);
    doc.setLineWidth(0.18);doc.line(18,41,W-18,41);

    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(20,20,20);doc.text(title,W/2,52,{align:'center'});
    doc.setLineWidth(0.25);doc.line(58,54,W-58,54);
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.text('Nomor : '+safe(x.nomor_surat),W/2,61,{align:'center'});

    let y=76;
    y=text(doc,'Yang bertanda tangan di bawah ini :',M,y,CW,10);
    y=field(doc,'Nama','Ketua RT 04 / RW 01',y+2);
    y=field(doc,'Jabatan','Ketua RT 04 / RW 01',y);
    y=field(doc,'Alamat','Dusun Dawung RT 04 / RW 01',y);
    y+=6;
    y=text(doc,'Menerangkan dengan sebenar-benarnya bahwa :',M,y,CW,10);
    y+=5;
    y=field(doc,'Nama',p.nama,y);
    y=field(doc,'NIK',p.nik,y);
    y=field(doc,'Jenis Kelamin',gender(p.jenis_kelamin),y);
    y=field(doc,'Tempat, tanggal lahir',`${p.tempat_lahir}${p.tanggal_lahir&&p.tanggal_lahir!=='-'?', '+prettyDate(p.tanggal_lahir):''}`,y);
    if(p.agama)y=field(doc,'Agama',p.agama,y);
    y=field(doc,'Alamat',p.alamat,y);

    y+=7;
    specificParagraphs(x,p).forEach(par=>{y=text(doc,par,M,y,CW,10);y+=4;});
    y+=2;
    y=text(doc,'Demikian surat keterangan ini kami buat dengan sebenarnya, dan dapat dipergunakan sebagaimana mestinya.',M,y,CW,10);

    if(y>214){
      // fallback ke font sedikit lebih kecil agar tetap satu halaman untuk formulir yang panjang.
      doc.setFontSize(9.5);
    }
    signature(doc,issueDate,qr);

    doc.setDrawColor(180,180,180);doc.setLineWidth(0.2);doc.line(M,H-27,W-M,H-27);
    doc.setFont('helvetica','normal');doc.setFontSize(6.7);doc.setTextColor(85,85,85);
    doc.text('Kode Pengajuan: '+safe(x.kode_pengajuan),M,H-20);
    doc.text('Hash Verifikasi: '+hash.slice(0,24)+'...',M,H-15.8);
    doc.text('Dokumen diterbitkan melalui Portal Digital Dusun Dawung.',M,H-11.7);

    const filename=safe(x.nomor_surat).replace(/[^A-Za-z0-9._-]+/g,'_')+'.pdf';
    doc.save(filename);
  }

  function renderResult(x,verified=false){
    const downloadable=x.status==='selesai'&&downloadableTypes.has(x.jenis)&&safe(x.nomor_surat);
    const f=richData(x);
    setResult(`
      ${verified?'<div class="verify-ok">✓ Dokumen terverifikasi terhadap data pengajuan di Portal Digital Dusun Dawung.</div>':''}
      <div class="result-row"><span>Kode Pengajuan</span><b>${esc(x.kode_pengajuan||'-')}</b></div>
      <div class="result-row"><span>Pemohon</span><b>${esc(x.pemohon_nama||f.nama||'-')}</b></div>
      <div class="result-row"><span>Jenis Surat</span><b>${esc(typeLabel(x))}</b></div>
      <div class="result-row"><span>Tanggal</span><b>${esc(x.tanggal_pengajuan||'-')}</b></div>
      <div class="result-row"><span>Status</span><b><span class="status">${esc(labels[x.status]||x.status||'-')}</span></b></div>
      <div class="result-row"><span>Nomor Surat</span><b>${esc(x.nomor_surat||'-')}</b></div>
      ${downloadable?'<div class="download-box"><b>Surat sudah selesai.</b><p>Download PDF dan cetak sendiri. PDF mengikuti format surat resmi Dusun Dawung dan dilengkapi QR verifikasi.</p><button class="btn green" id="downloadPdfBtn" type="button">⬇ Download Surat PDF</button></div>':''}
    `);
    if(downloadable){
      const b=document.getElementById('downloadPdfBtn');
      if(b)b.onclick=async()=>{b.disabled=true;b.textContent='Menyiapkan PDF...';try{await downloadPdf(x);}catch(e){alert('PDF belum dapat dibuat: '+(e.message||e));}finally{b.disabled=false;b.textContent='⬇ Download Surat PDF';}};
    }
  }

  function setResult(html){if(result)result.innerHTML=html;}

  async function check(code,expectedHash='',fromQr=false){
    if(checking)return;checking=true;setResult('<p>Memeriksa pengajuan...</p>');
    try{
      if(!sb)throw new Error('Supabase belum termuat.');
      const kode=safe(code).toUpperCase();if(!kode){setResult('<div class="error">Masukkan kode pengajuan.</div>');return;}
      const {data,error}=await sb.rpc('cek_pengajuan_public',{p_kode:kode});
      if(error)throw error;
      if(!data||!data.length){setResult('<div class="error">Kode pengajuan tidak ditemukan. Periksa kembali kode yang Anda masukkan.</div>');return;}
      let current=data[0];
      current=await getPdfData(kode,current);
      if(expectedHash){
        const actual=await documentHash(current);
        if(actual.toLowerCase()!==expectedHash.toLowerCase()){
          setResult('<div class="error">QR ditemukan, tetapi data dokumen tidak cocok dengan data pengajuan saat ini.</div>');return;
        }
      }
      renderResult(current,fromQr||!!expectedHash);
    }catch(err){
      console.error('[Cek Pengajuan]',err);
      setResult('<div class="error">Pengajuan belum dapat diperiksa. '+esc(err.message||'Terjadi kesalahan pada layanan.')+'</div>');
    }finally{checking=false;}
  }

  if(form)form.addEventListener('submit',e=>{e.preventDefault();check(codeInput?.value||'');});
  const params=new URLSearchParams(location.search),queryCode=params.get('kode')||'',queryHash=params.get('hash')||'',qrMode=params.get('verifikasi')==='1';
  if(queryCode&&codeInput){codeInput.value=queryCode.toUpperCase();check(queryCode,queryHash,qrMode);}
  window.downloadPengajuanPdf=downloadPdf;
})();
