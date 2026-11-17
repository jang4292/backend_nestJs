import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  DictionaryForm,
  DictionaryLexeme,
  DictionaryRevision,
  DictionarySense,
  DictionarySenseConcept,
} from '../entities/dictionary.entities';

export interface RevisionContent {
  forms: {
    id: number;
    text: string;
    script: string | null;
    type: string | null;
  }[];
  senses: {
    id: number;
    position: number;
    definition: string;
    conceptIds: number[];
  }[];
}

export function assertWellFormedText(value: string): void {
  if (Buffer.from(value, 'utf8').toString('utf8') !== value) {
    throw new BadRequestException('Text contains invalid Unicode');
  }
}

export function normalizeDictionaryText(value: string): string {
  assertWellFormedText(value);
  // 표시 원문은 보존하고 검색 키만 NFC·소문자로 통일합니다. 길이는 UTF-16 코드 단위가 아닌 코드 포인트로 셉니다.
  // Preserve display text; normalize only the search key and count Unicode code points.
  const normalized = value.normalize('NFC').toLowerCase();
  if (Array.from(normalized).length > 512) {
    throw new BadRequestException('Normalized text is too long');
  }
  return normalized;
}

export async function loadRevisionContent(
  manager: EntityManager,
  revisionIds: number[],
): Promise<Map<number, RevisionContent>> {
  const content = new Map<number, RevisionContent>(
    revisionIds.map((id) => [id, { forms: [], senses: [] }]),
  );
  if (revisionIds.length === 0) {
    return content;
  }

  // 여러 revision의 하위 항목을 일괄 조회해 목록의 항목마다 쿼리가 늘어나는 N+1 문제를 피합니다.
  // Batch child rows across revisions to avoid a query per item in list responses.
  const [forms, senses] = await Promise.all([
    manager.find(DictionaryForm, {
      where: { revisionId: In(revisionIds) },
      order: { id: 'ASC' },
    }),
    manager.find(DictionarySense, {
      where: { revisionId: In(revisionIds) },
      order: { revisionId: 'ASC', position: 'ASC' },
    }),
  ]);
  const links =
    senses.length === 0
      ? []
      : await manager.find(DictionarySenseConcept, {
          where: { senseId: In(senses.map((sense) => sense.id)) },
          order: { conceptId: 'ASC' },
        });
  const conceptsBySense = new Map<number, number[]>();
  for (const link of links) {
    const conceptIds = conceptsBySense.get(link.senseId) ?? [];
    conceptIds.push(link.conceptId);
    conceptsBySense.set(link.senseId, conceptIds);
  }
  for (const form of forms) {
    content.get(form.revisionId)?.forms.push({
      id: form.id,
      text: form.text,
      script: form.script,
      type: form.type,
    });
  }
  for (const sense of senses) {
    content.get(sense.revisionId)?.senses.push({
      id: sense.id,
      position: sense.position,
      definition: sense.definition,
      conceptIds: conceptsBySense.get(sense.id) ?? [],
    });
  }
  return content;
}

export async function presentAdminLexeme(
  manager: EntityManager,
  lexeme: DictionaryLexeme,
  revision: DictionaryRevision,
) {
  const content = await loadRevisionContent(manager, [revision.id]);
  const details = content.get(revision.id);
  if (!details) {
    throw new Error('Dictionary revision content could not be loaded');
  }
  return {
    id: lexeme.id,
    languageTag: lexeme.languageTag,
    currentVersion: lexeme.currentVersion,
    revision: {
      id: revision.id,
      version: revision.version,
      status: revision.status,
      lemma: revision.lemma,
      partOfSpeech: revision.partOfSpeech,
      sourceId: revision.sourceId,
      createdBy: revision.createdBy,
      submittedAt: revision.submittedAt,
      approvedBy: revision.approvedBy,
      approvedAt: revision.approvedAt,
      createdAt: revision.createdAt,
      ...details,
    },
  };
}
