import { TopicGraph } from "@/components/graph/TopicGraph";

export const metadata = {
  title: "แผนที่ประเด็นสิทธิ - กสม.",
  description: "กราฟความสัมพันธ์ระหว่างประเด็นสิทธิมนุษยชนและกรณีตรวจสอบ",
};

export default function GraphPage() {
  return <TopicGraph />;
}
