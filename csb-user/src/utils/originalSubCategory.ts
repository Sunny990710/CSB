import { Sample } from '@/types';

export function sampleMatchesOriginalSubCategory(
  sample: Sample,
  subCategories: string[]
): boolean {
  if (subCategories.length === 0) return true;

  const fields = [
    sample.subCategory,
    sample.topic,
    sample.itemType,
    sample.classification,
  ]
    .filter(Boolean)
    .map(String);

  const hay = `${sample.name} ${sample.description || ''}`.toLowerCase();

  return subCategories.some((sub) => {
    const key = sub.toLowerCase();
    if (fields.some((f) => f === sub || f.toLowerCase().includes(key))) return true;
    return hay.includes(key);
  });
}
