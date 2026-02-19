export interface AdminPostSummary {
  readonly slug: string;
  readonly fileName: string;
  readonly title: string;
  readonly date: string;
}

export interface AdminPostDraft {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly date: string;
  readonly updatedAt?: string;
  readonly tags: readonly string[];
  readonly cover?: string;
  readonly content: string;
}
