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
  let current = null;
  let checking = false;

  const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const formData = x => x && x.data_form && typeof x.data_form === 'object' ? x.data_form : {};
  const safe = s => String(s ?? '').trim();

  function prettyDate(v){
    if(!v) return '-';
    const d = new Date(v);
    if(Number.isNaN(d.getTime())) return safe(v);
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  }

  function typeLabel(x){
    const f = formData(x);
    if(x?.jenis === 'lainnya' && f.subjenis) return `Surat Keterangan - ${safe(f.subjenis)}`;
    return serviceTitles[x?.jenis] || x?.jenis_label || x?.jenis || 'Surat Keterangan';
  }

  function stableStringify(value){
    if(value === null || typeof value !== 'object') return JSON.stringify(value);
    if(Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',') + '}';
  }

  async function sha256(text){
    if(!window.crypto?.subtle) throw new Error('Browser tidak mendukung verifikasi dokumen aman.');
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function canonicalPayload(x){
    return {
      kode_pengajuan:safe(x?.kode_pengajuan),
      nomor_surat:safe(x?.nomor_surat),
      jenis:safe(x?.jenis),
      jenis_label:safe(x?.jenis_label),
      pemohon_nama:safe(x?.pemohon_nama),
      status:safe(x?.status),
      tanggal_pengajuan:safe(x?.tanggal_pengajuan),
      catatan_admin:safe(x?.catatan_admin),
      data_form:formData(x)
    };
  }

  async function documentHash(x){
    return sha256(stableStringify(canonicalPayload(x)));
  }

  function verificationUrl(hash, kode){
    const u = new URL('cek-pengajuan.html', window.location.href);
    u.searchParams.set('kode', kode);
    u.searchParams.set('verifikasi','1');
    u.searchParams.set('hash', hash);
    return u.toString();
  }

  function setResult(html){
    if(result) result.innerHTML = html;
  }

  function renderResult(x, verifiedFromQr=false, providedHash=''){
    const downloadable = x.status === 'selesai' && downloadableTypes.has(x.jenis) && safe(x.nomor_surat);
    const verificationLine = verifiedFromQr
      ? '<div class="verify-ok">✓ Dokumen terverifikasi terhadap data pengajuan di Portal Digital Dusun Dawung.</div>'
      : '';

    setResult(`
      ${verificationLine}
      <div class="result-row"><span>Kode Pengajuan</span><b>${esc(x.kode_pengajuan)}</b></div>
      <div class="result-row"><span>Pemohon</span><b>${esc(x.pemohon_nama)}</b></div>
      <div class="result-row"><span>Jenis Surat</span><b>${esc(typeLabel(x))}</b></div>
      <div class="result-row"><span>Tanggal</span><b>${esc(x.tanggal_pengajuan||'-')}</b></div>
      <div class="result-row"><span>Status</span><b><span class="status">${esc(labels[x.status]||x.status)}</span></b></div>
      <div class="result-row"><span>Nomor Surat</span><b>${esc(x.nomor_surat||'-')}</b></div>
      <div class="result-row"><span>Catatan</span><b>${esc(x.catatan_admin||'-')}</b></div>
      ${downloadable ? `<div class="download-box"><b>Surat sudah selesai.</b><p>Anda dapat mengunduh surat dalam format PDF dan mencetaknya sendiri.</p><button class="btn green" type="button" id="downloadPdfBtn">⬇ Download Surat PDF</button><small>PDF dilengkapi QR verifikasi dokumen.</small></div>` : ''}
      ${x.status==='selesai' && !downloadable ? '<div class="download-box"><b>Pengajuan selesai.</b><p>Jenis pengajuan ini belum memiliki template surat PDF otomatis.</p></div>' : ''}
    `);

    if(downloadable){
      const btn = document.getElementById('downloadPdfBtn');
      if(btn) btn.onclick = async()=>{
        btn.disabled = true;
        btn.textContent = 'Menyiapkan PDF...';
        try{ await downloadPdf(x); }
        catch(err){ alert('PDF belum dapat dibuat: '+(err?.message||err)); }
        finally{ btn.disabled=false;btn.textContent='⬇ Download Surat PDF'; }
      };
    }

    return {hash:providedHash};
  }

  function getTextColor(doc){
    doc.setTextColor(35,40,36);
  }

  function drawWrapped(doc, text, x, y, width, lineHeight=5.5, fontSize=10){
    doc.setFont('helvetica','normal');
    doc.setFontSize(fontSize);
    getTextColor(doc);
    const lines = doc.splitTextToSize(safe(text) || '-', width);
    doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  }

  function addField(doc, label, value, x, y, width){
    doc.setFont('helvetica','bold');
    doc.setFontSize(9.5);
    getTextColor(doc);
    doc.text(label, x, y);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const next = drawWrapped(doc, value || '-', x + 34, y, width - 34, 5.2, 10);
    return Math.max(y + 5.2, next);
  }

  function getPerson(x){
    const f=formData(x);
    return {
      nama:safe(f.pemohon_nama || x.pemohon_nama || '-'),
      nik:safe(f.nik || '-'),
      tempat_lahir:safe(f.tempat_lahir || '-'),
      tanggal_lahir:safe(f.tanggal_lahir || '-'),
      jenis_kelamin:safe(f.jenis_kelamin || '-'),
      alamat:safe(f.alamat || '-'),
      rt_rw:safe(f.rt_rw || 'RT 04 / RW 01'),
      no_hp:safe(f.no_hp || '-')
    };
  }

  function specificBody(x){
    const f = formData(x);
    const rows = [];
    if(x.jenis==='surat_pengantar'){
      rows.push(['Tujuan Surat', f.tujuan_surat]);
      rows.push(['Keperluan', f.keperluan || x.keperluan]);
    } else if(x.jenis==='domisili'){
      rows.push(['Alamat Domisili', f.alamat_domisili]);
      rows.push(['Lama Tinggal', f.lama_tinggal]);
      rows.push(['Status Tinggal', f.status_tinggal]);
      rows.push(['Keperluan', f.keperluan || x.keperluan]);
    } else if(x.jenis==='usaha'){
      rows.push(['Nama Usaha', f.nama_usaha]);
      rows.push(['Jenis Usaha', f.jenis_usaha]);
      rows.push(['Lama Usaha', f.lama_usaha]);
      rows.push(['Alamat Usaha', f.alamat_usaha]);
      rows.push(['Keperluan', f.keperluan || x.keperluan]);
    } else if(x.jenis==='lainnya'){
      rows.push(['Jenis Keterangan', f.subjenis]);
      rows.push(['Keperluan', f.keperluan || x.keperluan]);
    }
    return rows.filter(r=>safe(r[1]));
  }

  async function makeQrDataUrl(text){
    if(!window.QRCode) throw new Error('Library QR belum termuat.');
    const host = document.createElement('div');
    host.style.position='fixed';host.style.left='-99999px';host.style.top='-99999px';host.style.width='180px';host.style.height='180px';
    document.body.appendChild(host);
    try{
      new QRCode(host,{text,width:180,height:180,colorDark:'#1b4026',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      await new Promise(r=>setTimeout(r,180));
      const canvas = host.querySelector('canvas');
      if(canvas) return canvas.toDataURL('image/png');
      const img = host.querySelector('img');
      if(img){
        if(!img.complete) await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;});
        return img.src;
      }
      throw new Error('QR tidak berhasil dibuat.');
    }finally{host.remove();}
  }

  async function loadPdfLibs(){
    if(window.jspdf?.jsPDF && window.QRCode) return;
    throw new Error('Library PDF/QR belum termuat. Muat ulang halaman lalu coba lagi.');
  }

  function titleForPdf(x){
    const f=formData(x);
    if(x?.jenis==='surat_pengantar') return 'SURAT PENGANTAR';
    if(x?.jenis==='domisili') return 'SURAT KETERANGAN DOMISILI';
    if(x?.jenis==='usaha') return 'SURAT KETERANGAN USAHA';
    if(x?.jenis==='lainnya') return 'SURAT KETERANGAN';
    return typeLabel(x).toUpperCase();
  }

  function prettyGender(v){
    const t=safe(v).toLowerCase();
    if(t==='l'||t==='laki-laki'||t==='laki laki'||t==='male') return 'Laki-laki';
    if(t==='p'||t==='perempuan'||t==='female') return 'Perempuan';
    return safe(v)||'-';
  }

  function drawSectionTitle(doc, text, x, y, width){
    doc.setFillColor(236,245,239);
    doc.roundedRect(x,y-4,width,8,2,2,'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.setTextColor(43,88,57);
    doc.text(text,x+4,y+0.5);
  }

  function drawIdentityTable(doc, p, x, y, width){
    const rows=[
      ['Nama',p.nama],
      ['NIK',p.nik],
      ['Tempat/Tanggal Lahir',`${p.tempat_lahir}, ${p.tanggal_lahir && p.tanggal_lahir!=='-' ? prettyDate(p.tanggal_lahir) : '-'}`],
      ['Jenis Kelamin',prettyGender(p.jenis_kelamin)],
      ['Alamat',p.alamat],
      ['RT / RW',p.rt_rw]
    ];
    const labelW=47, valueW=width-labelW;
    rows.forEach(([label,value])=>{
      const lines=doc.splitTextToSize(safe(value)||'-',valueW-5);
      const rowH=Math.max(7,lines.length*4.8+3);
      doc.setFillColor(248,250,248);
      doc.rect(x,y,width,rowH,'F');
      doc.setDrawColor(220,228,221);
      doc.rect(x,y,width,rowH,'S');
      doc.setFont('helvetica','bold');doc.setFontSize(8.8);doc.setTextColor(65,73,67);
      doc.text(label,x+3.5,y+4.7);
      doc.setFont('helvetica','normal');doc.setFontSize(9.2);doc.setTextColor(35,40,36);
      doc.text(lines,x+labelW,y+4.7);
      doc.line(x+labelW,y,x+labelW,y+rowH);
      y+=rowH;
    });
    return y;
  }

  function specificParagraphs(x){
    const f=formData(x);
    const out=[];
    if(x.jenis==='surat_pengantar'){
      const tujuan=safe(f.tujuan_surat || '-');
      const keperluan=safe(f.keperluan || x.keperluan || '-');
      out.push(`Yang bersangkutan bermaksud memperoleh surat pengantar untuk tujuan ${tujuan}, dengan keperluan ${keperluan}.`);
    }else if(x.jenis==='domisili'){
      const alamat=safe(f.alamat_domisili || '-');
      const lama=safe(f.lama_tinggal || '-');
      const status=safe(f.status_tinggal || '-');
      const kep=safe(f.keperluan || x.keperluan || '-');
      out.push(`Yang bersangkutan benar berdomisili di ${alamat}, telah tinggal selama ${lama}, dengan status tempat tinggal ${status}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${kep}.`);
    }else if(x.jenis==='usaha'){
      const nama=safe(f.nama_usaha || '-');
      const jenis=safe(f.jenis_usaha || '-');
      const lama=safe(f.lama_usaha || '-');
      const alamat=safe(f.alamat_usaha || '-');
      const kep=safe(f.keperluan || x.keperluan || '-');
      out.push(`Yang bersangkutan benar menjalankan usaha ${nama} dengan jenis usaha ${jenis}, telah berjalan selama ${lama}, dan beralamat di ${alamat}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${kep}.`);
    }else{
      const sub=safe(f.subjenis || typeLabel(x));
      const kep=safe(f.keperluan || x.keperluan || '-');
      out.push(`Yang bersangkutan memohon surat keterangan mengenai ${sub}.`);
      out.push(`Surat keterangan ini dibuat untuk keperluan ${kep}.`);
    }
    return out;
  }

  async function downloadPdf(x){
    if(x.status!=='selesai') throw new Error('Surat baru dapat diunduh setelah status Selesai.');
    if(!downloadableTypes.has(x.jenis)) throw new Error('Jenis pengajuan ini belum memiliki template PDF.');
    if(!safe(x.nomor_surat)) throw new Error('Nomor surat belum tersedia.');
    await loadPdfLibs();

    const {jsPDF} = window.jspdf;
    const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=210,H=297,M=20,contentW=W-2*M;
    const p=getPerson(x);
    const title=titleForPdf(x);
    const hash=await documentHash(x);
    const verifyUrl=verificationUrl(hash,x.kode_pengajuan);
    const qr=await makeQrDataUrl(verifyUrl);
    const issueDate=prettyDate(x.updated_at||x.tanggal_pengajuan||x.created_at);

    // Border / header
    doc.setFillColor(28,66,40);doc.rect(0,0,W,5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(28,66,40);
    doc.text('DUSUN DAWUNG',W/2,17,{align:'center'});
    doc.setFontSize(11);doc.text('RT 04 / RW 01',W/2,23,{align:'center'});
    doc.setFont('helvetica','italic');doc.setFontSize(8.7);doc.setTextColor(88,101,91);
    doc.text('“Sepi Ing Pamrih, Rame Ing Gawe”',W/2,29,{align:'center'});
    doc.setDrawColor(28,66,40);doc.setLineWidth(0.65);doc.line(M,34,W-M,34);
    doc.setDrawColor(190,200,193);doc.setLineWidth(0.2);doc.line(M,36,W-M,36);

    doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(35,40,36);
    doc.text(title,W/2,47,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(80,87,82);
    doc.text('Nomor: '+safe(x.nomor_surat),W/2,53,{align:'center'});

    let y=67;
    y=drawWrapped(doc,'Yang bertanda tangan di bawah ini, Ketua RT 04 / RW 01 Dusun Dawung, menerangkan dengan sebenarnya berdasarkan data pengajuan yang diterima melalui Portal Digital Dusun Dawung bahwa:',M,y,contentW,5.2,9.6);
    y+=5;

    drawSectionTitle(doc,'IDENTITAS PEMOHON',M,y,contentW); y+=9;
    y=drawIdentityTable(doc,p,M,y,contentW);
    y+=7;

    drawSectionTitle(doc,'KETERANGAN',M,y,contentW); y+=10;
    specificParagraphs(x).forEach(par=>{ y=drawWrapped(doc,par,M,y,contentW,5.3,9.7); y+=3.2; });

    y+=2;
    y=drawWrapped(doc,'Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya. Data pada dokumen ini dapat diverifikasi melalui QR Code yang tercantum pada bagian pengesahan.',M,y,contentW,5.3,9.5);

    const signY=Math.min(Math.max(y+10,201),218);
    const sigX=128, qrX=164, qrY=signY-3;

    doc.setFont('helvetica','normal');doc.setFontSize(9.4);doc.setTextColor(68,75,70);
    doc.text('Dusun Dawung, '+issueDate,sigX,signY,{align:'center'});
    doc.setFont('helvetica','bold');doc.setFontSize(9.8);doc.setTextColor(35,40,36);
    doc.text('Ketua RT 04 / RW 01',sigX,signY+6,{align:'center'});
    doc.setDrawColor(150,160,152);doc.setLineWidth(0.25);doc.line(sigX-28,signY+25,sigX+28,signY+25);
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(97,105,99);
    doc.text('Tanda tangan / stempel Ketua RT',sigX,signY+30,{align:'center'});

    doc.addImage(qr,'PNG',qrX,qrY+3,27,27);
    doc.setFont('helvetica','bold');doc.setFontSize(7.6);doc.setTextColor(43,88,57);
    doc.text('QR VERIFIKASI',qrX+13.5,qrY+34,{align:'center'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.7);doc.setTextColor(95,103,98);
    doc.text(['Pindai untuk memeriksa','data dokumen pada portal.'],qrX+13.5,qrY+39,{align:'center'});

    // Footer box
    const fy=H-26;
    doc.setFillColor(248,250,248);doc.roundedRect(M,fy,contentW,15,2,2,'F');
    doc.setDrawColor(221,228,222);doc.roundedRect(M,fy,contentW,15,2,2,'S');
    doc.setFont('helvetica','normal');doc.setFontSize(6.9);doc.setTextColor(90,99,93);
    doc.text(`Kode Pengajuan: ${safe(x.kode_pengajuan)}`,M+4,fy+5.2);
    doc.text(`Hash Verifikasi: ${hash.slice(0,24)}...`,M+4,fy+9.5);
    doc.text('Dokumen diterbitkan melalui Portal Digital Dusun Dawung.',M+4,fy+13.2);

    const filename=`${safe(x.nomor_surat).replace(/[^A-Za-z0-9._-]+/g,'_')}.pdf`;
    doc.save(filename);
  }

  async function check(code, expectedHash='', verifiedFromQr=false){
    if(checking) return;
    checking=true;
    setResult('<p>Memeriksa pengajuan...</p>');
    try{
      if(!sb) throw new Error('Supabase belum termuat.');
      const kode = safe(code).toUpperCase();
      if(!kode){setResult('<div class="error">Masukkan kode pengajuan.</div>');return;}
      const {data,error}=await sb.rpc('cek_pengajuan_public',{p_kode:kode});
      if(error) throw error;
      if(!data||!data.length){setResult('<div class="error">Kode pengajuan tidak ditemukan. Periksa kembali kode yang Anda masukkan.</div>');return;}
      current=data[0];

      // Enrich the result with the full data used by the PDF template.
      // The public status RPC may intentionally return only summary fields,
      // while identity/service details are stored in surat_pengajuan.data_form.
      try{
        const {data:pdfData,error:pdfError}=await sb.rpc('get_pengajuan_pdf',{p_kode:kode});
        if(pdfError) throw pdfError;
        if(pdfData && typeof pdfData==='object'){
          current={...current,...pdfData};
        }
      }catch(pdfErr){
        console.warn('[Cek Pengajuan] Detail PDF tidak termuat:',pdfErr);
      }

      let qrVerified=false;
      if(expectedHash){
        try{
          const actualHash=await documentHash(current);
          qrVerified=actualHash.toLowerCase()===expectedHash.toLowerCase();
          if(!qrVerified){
            setResult('<div class="error">QR ditemukan, tetapi data dokumen tidak cocok dengan data pengajuan saat ini.</div>');
            return;
          }
        }catch(err){
          setResult('<div class="error">Verifikasi QR tidak dapat dilakukan: '+esc(err.message||err)+'</div>');return;
        }
      }
      renderResult(current,verifiedFromQr||qrVerified,expectedHash);
    }catch(err){
      console.error('[Cek Pengajuan]',err);
      setResult('<div class="error">Pengajuan belum dapat diperiksa. '+esc(err.message||'Terjadi kesalahan pada layanan.')+'</div>');
    }finally{checking=false;}
  }

  if(form){
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      await check(codeInput?.value||'');
    });
  }

  // QR opens this same page and can auto-verify the document.
  const params = new URLSearchParams(location.search);
  const queryCode = params.get('kode') || '';
  const queryHash = params.get('hash') || '';
  const qrMode = params.get('verifikasi') === '1';
  if(queryCode && codeInput){
    codeInput.value=queryCode.toUpperCase();
    check(queryCode,queryHash,qrMode);
  }

  window.downloadPengajuanPdf = downloadPdf;
})();
