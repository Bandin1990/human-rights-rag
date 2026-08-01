export type DocumentType = string;

export type RightsCategory =
  | "สิทธิพลเมืองและการเมือง"
  | "สิทธิชุมชนและสิ่งแวดล้อม"
  | "สิทธิในกระบวนการยุติธรรม"
  | "สิทธิเด็ก"
  | "สิทธิแรงงาน"
  | "ความเสมอภาคและการไม่เลือกปฏิบัติ";

export type SourceSystem = "กสม." | "ศาลยุติธรรม" | "ราชกิจจานุเบกษา" | "องค์การสหประชาชาติ" | "แหล่งวิชาการ";
export type AuthorityLevel = "กฎหมาย" | "คำพิพากษา" | "ความเห็น กสม." | "มาตรฐานระหว่างประเทศ" | "เอกสารประกอบ";
export type FileFormat = "pdf" | "docx" | "doc" | "md" | "html";
export type DocumentLanguage = "th" | "en" | "th-en";

export type DocumentSection = {
  id: string;
  page?: number;
  anchor?: string;
  heading: string;
  content: string;
};

export type HumanRightsDocument = {
  id: string;
  title: string;
  summary: string;
  year: number;
  buddhistYear: number;
  type: DocumentType;
  categories: RightsCategory[];
  pages?: number;
  publishedAt: string;
  agency: string;
  sourceSystem: SourceSystem;
  sourceUrl?: string;
  documentNumber?: string;
  authorityLevel: AuthorityLevel;
  language: DocumentLanguage;
  fileFormats: FileFormat[];
  featured?: boolean;
  verifiedAt?: string;
  shortSummary?: string;
  longSummary?: string;
  timeline?: { order: number | string; title: string; subtitle?: string; description: string; date?: string }[];
  relatedPersons?: { role: string; names: string[] }[];
  relatedInternationalLaws?: string[];
  relatedThaiLaws?: string[];
  sections: DocumentSection[];
};

export type SearchFilters = {
  query?: string;
  year?: number;
  type?: DocumentType;
  category?: RightsCategory;
  sourceSystem?: SourceSystem;
  language?: DocumentLanguage;
};

export type Citation = {
  documentId: string;
  sectionId: string;
  title: string;
  page?: number;
  anchor?: string;
  excerpt: string;
  sourceUrl?: string;
};

export type Answer = { answer: string; citations: Citation[]; disclaimer: string; mode?: "evidence" | "llm-rag"; model?: string };
export type SearchResponse = { results: HumanRightsDocument[]; mode: "mock" | "cloud" | "semantic"; total: number };
