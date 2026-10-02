const roleButtons=document.querySelectorAll(".tabs button");let role="warga";roleButtons.forEach(b=>b.addEventListener("click",()=>{role=b.dataset.role;roleButtons.forEach(x=>x.classList.remove("active"));b.classList.add("active")}));
const form=document.querySelector("#loginForm");
form.addEventListener("submit",async e=>{e.preventDefault();const id=document.querySelector("#identity").value.trim(),pw=document.querySelector("#password").value;
  if(window.DAWUNG_SUPABASE){
    const {data,error}=await window.DAWUNG_SUPABASE.auth.signInWithPassword({email:id,password:pw});
    if(error){alert("Login gagal: "+error.message);return;}
    const {data:profile,error:pe}=await window.DAWUNG_SUPABASE.from("profiles").select("role,nama").eq("id",data.user.id).single();
    if(pe||!profile){await window.DAWUNG_SUPABASE.auth.signOut();alert("Profil pengguna belum dibuat oleh pengurus.");return;}
    if(role!=="warga" && !["admin","ketua_rt"].includes(profile.role)){await window.DAWUNG_SUPABASE.auth.signOut();alert("Akun ini tidak memiliki akses pengurus.");return;}
    if(role==="warga" && profile.role!=="warga"){await window.DAWUNG_SUPABASE.auth.signOut();alert("Pilih tab Warga untuk akun warga.");return;}
    localStorage.setItem("dawung_auth",profile.role);localStorage.setItem("dawung_user",JSON.stringify({id:data.user.id,nama:profile.nama,email:data.user.email,role:profile.role}));
    location.href=["admin","ketua_rt"].includes(profile.role)?"admin/":"warga/"; return;
  }
  alert("Supabase belum termuat.");
});
document.querySelector("#forgot").onclick=async e=>{e.preventDefault();const email=document.querySelector("#identity").value.trim();if(!window.DAWUNG_SUPABASE){alert("Supabase belum termuat.");return;}if(!email){alert("Masukkan email terlebih dahulu.");return;}const {error}=await window.DAWUNG_SUPABASE.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/login.html"});alert(error?error.message:"Link reset password telah dikirim jika email terdaftar.");};
document.querySelector("#register").onclick=e=>{e.preventDefault();alert("Pendaftaran warga dilakukan setelah diverifikasi pengurus RT.");};