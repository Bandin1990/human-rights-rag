# Human Rights Knowledge & Case Workspace

## เริ่มใช้งานหลังบ้าน

1. คัดลอก `.env.example` เป็น `.env.local` ภายในโฟลเดอร์ `web`
2. กรอกค่า Supabase, OpenAI และ `ADMIN_IMPORT_SECRET`
3. รัน SQL ใน `../supabase/schema.sql` กับโปรเจกต์ Supabase
4. ติดตั้งและเปิดเว็บ

```powershell
npm.cmd install
npm.cmd run dev
```

เปิด `http://localhost:3000/admin/import` แล้วเข้าสู่ระบบด้วยค่า `ADMIN_IMPORT_SECRET` จากนั้นอัปโหลดไฟล์ `.md`, `.docx` หรือ `.pdf` ได้ทันที ระบบจะเก็บไฟล์ต้นฉบับแบบ private สร้าง sections และ semantic embeddings อัตโนมัติ

## ตรวจสอบก่อนขึ้นใช้งานจริง

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit --incremental false
npm.cmd run build
```

- ใช้ `SUPABASE_SECRET_KEY` เฉพาะฝั่งเซิร์ฟเวอร์ ห้ามนำไปใส่ตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_`
- ตั้ง `ADMIN_IMPORT_SECRET` ให้ยาวและสุ่มเฉพาะระบบนี้
- คุกกี้ผู้ดูแลเป็นลายเซ็นและหมดอายุใน 8 ชั่วโมง; ไม่เก็บรหัสผู้ดูแลไว้ในเบราว์เซอร์
