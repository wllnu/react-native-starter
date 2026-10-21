import { useLocalSearchParams } from "expo-router";
import { z } from "zod";

import { NoteScreen } from "@/features/notes";

export { ErrorBoundary } from "@/shared/monitoring/ErrorBoundary";

const ParamsSchema = z.object({ id: z.string().min(1) });

export default function Note() {
  const { id } = ParamsSchema.parse(useLocalSearchParams());
  return <NoteScreen id={id} />;
}
