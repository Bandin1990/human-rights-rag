# ระบบงานเรื่องร้องเรียนและ Report Studio

โมดูลนี้เป็น vertical slice ตาม `NHRC_COMPLAINT_SYSTEM_BLUEPRINT.md` ครอบคลุมการรับเรื่อง กลั่นกรอง ตรวจสอบพยานหลักฐาน จัดทำรายงานตามข้อ 43 และค้นกฎหมาย/รายงานเผยแพร่จาก Human Rights Knowledge RAG

## เส้นทางใช้งาน

- `/cases` — dashboard งานของผู้ใช้ เรื่องใกล้กำหนด งานรอตรวจ และเรื่องกำลังทำรายงาน
- `/cases/new` — รับเรื่องหลายช่องทาง จัดชั้นข้อมูล และสร้าง deadline 15 วัน
- `/cases/[id]` — ภาพรวมสำนวน รายการกลั่นกรอง evidence matrix timeline และ Report Studio
- `/cases/login` — Supabase Auth สำหรับระบบจริง
- `/api/cases/[id]/rag` — ค้นเฉพาะ public knowledge พร้อม citation และ AI audit
- `/api/cases/[id]/report` — บันทึก report version ใหม่หรือส่งให้ผู้บังคับบัญชาตรวจ

## เปิดโหมดสาธิต

```powershell
cd D:\human-rights-rag\web
npm run dev
```

เมื่ออยู่นอก production ระบบใช้ข้อมูลตัวอย่างโดยอัตโนมัติ เว้นแต่กำหนด `CASE_DEMO_MODE=false` ข้อมูลที่สร้างในโหมดสาธิตอยู่ในหน่วยความจำและหายเมื่อหยุด dev server

## ติดตั้งฐานข้อมูลจริง

1. รัน `supabase/schema.sql` ก่อน เพื่อสร้าง `public.documents` และ `public.document_sections`
2. รัน `supabase/case_management.sql` ผ่าน Supabase SQL Editor
3. ไปที่ Data API settings แล้วเพิ่ม `case_management` ใน exposed schemas
4. ตรวจว่า bucket `case-evidence` เป็น private
5. ตั้งค่าตัวแปรใน `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
CASE_DEMO_MODE=false
```

6. สร้างผู้ใช้ด้วย Supabase Auth แล้วกำหนดบทบาท ตัวอย่าง:

```sql
insert into case_management.user_roles(user_id, role, display_name)
values ('AUTH_USER_UUID', 'case_officer', 'ชื่อเจ้าหน้าที่');
```

7. เพิ่ม assignment ให้ผู้ใช้เข้าถึงสำนวนเฉพาะที่ได้รับมอบหมาย หรือใช้บทบาทกำกับดูแลตาม RLS

## หลักความปลอดภัย

- `system_admin` ไม่มีสิทธิอ่านสำนวนโดยปริยาย
- RLS ตรวจทั้งบทบาท การมอบหมาย และผู้สร้างเรื่อง
- หลักฐานอยู่ใน private bucket โดย key ต้องขึ้นต้นด้วย complaint UUID
- การแก้สถานะ complaint/report สร้าง audit event; audit log เป็น append-only
- ร่างรายงานทุกครั้งสร้าง version ใหม่ ฉบับเดิมไม่ถูกเขียนทับ
- RAG ของสำนวนอ่านเฉพาะเอกสาร `public + published`
- API ปกปิดอีเมล เลขประจำตัว และเบอร์โทรจากคำค้นก่อนเรียก RAG
- AI ไม่รับ/ไม่รับคำร้อง ไม่ลงข้อยุติ ไม่ส่งหนังสือ และไม่เผยแพร่ข้อมูลเอง

## เกณฑ์ก่อนส่งร่างรายงาน

ระบบตรวจว่า:

1. องค์ประกอบตามข้อ 43 ครบ 6 ส่วน
2. ส่วนกฎหมายและหลักสิทธิมนุษยชนมี citation อย่างน้อยหนึ่งรายการ
3. เจ้าหน้าที่ระบุผลที่เสนอ: มีการละเมิด ไม่มีการละเมิด หรือยุติระหว่างตรวจสอบ
4. ผู้ใช้เป็นผู้กดส่งให้ผู้บังคับบัญชาเอง

## งานระยะถัดไป

vertical slice นี้ยังไม่แทนโมดูลเต็มสำหรับการประชุม/ลงมติ หนังสือแจ้ง การขยายเวลา การให้ถ้อยคำ การพิจารณาใหม่ publication/redaction approval และ recommendation follow-up ต้องยืนยันแบบและแนวปฏิบัติกับผู้ปฏิบัติงานตาม Phase 0 ก่อนเปิดใช้จริง
