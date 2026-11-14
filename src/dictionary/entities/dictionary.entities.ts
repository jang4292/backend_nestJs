import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DictionaryRevisionStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
}

const unicodeColumn = { charset: 'utf8mb4', collation: 'utf8mb4_bin' } as const;
const timestampColumn = {
  type: 'datetime',
  precision: 3,
  default: () => 'CURRENT_TIMESTAMP(3)',
} as const;

@Entity('dictionary_languages')
export class DictionaryLanguage {
  @PrimaryColumn({ type: 'varchar', length: 35, ...unicodeColumn })
  code: string;

  @Column({ type: 'varchar', length: 100, ...unicodeColumn })
  name: string;

  @Column({ type: 'varchar', length: 8, ...unicodeColumn })
  script: string;

  @Column({ type: 'int' })
  sortOrder: number;
}

@Entity('dictionary_sources')
export class DictionarySource {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200, ...unicodeColumn })
  name: string;

  @Column({ type: 'varchar', length: 200, ...unicodeColumn })
  license: string;

  @Column({ type: 'varchar', length: 500, ...unicodeColumn })
  attribution: string;

  @Column({ type: 'varchar', length: 1000, nullable: true, ...unicodeColumn })
  url: string | null;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

@Entity('dictionary_concepts')
export class DictionaryConcept {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', ...unicodeColumn })
  description: string;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

@Entity('dictionary_lexemes')
@Index('IDX_dictionary_lexemes_language', ['languageTag', 'id'])
export class DictionaryLexeme {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 35, ...unicodeColumn })
  languageTag: string;

  @ManyToOne(() => DictionaryLanguage, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'languageTag',
    referencedColumnName: 'code',
    foreignKeyConstraintName: 'FK_dictionary_lexemes_language',
  })
  language: DictionaryLanguage;

  @Column({ type: 'int', default: 1 })
  currentVersion: number;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

@Entity('dictionary_revisions')
@Check(
  'CHK_dictionary_revisions_status',
  "`status` IN ('draft', 'in_review', 'approved')",
)
@Unique('UQ_dictionary_revisions_lexeme_version', ['lexemeId', 'version'])
@Unique('UQ_dictionary_revisions_id_lexeme', ['id', 'lexemeId'])
@Index('IDX_dictionary_revisions_search', ['normalizedLemma', 'id'])
export class DictionaryRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  lexemeId: number;

  @ManyToOne(() => DictionaryLexeme, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'lexemeId',
    foreignKeyConstraintName: 'FK_dictionary_revisions_lexeme',
  })
  lexeme: DictionaryLexeme;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'varchar', length: 20, ...unicodeColumn })
  status: DictionaryRevisionStatus;

  @Column({ type: 'varchar', length: 200, ...unicodeColumn })
  lemma: string;

  @Column({ type: 'varchar', length: 512, ...unicodeColumn })
  normalizedLemma: string;

  @Column({ type: 'varchar', length: 40, nullable: true, ...unicodeColumn })
  partOfSpeech: string | null;

  @Column({ type: 'int' })
  sourceId: number;

  @ManyToOne(() => DictionarySource, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'sourceId',
    foreignKeyConstraintName: 'FK_dictionary_revisions_source',
  })
  source: DictionarySource;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'createdBy',
    foreignKeyConstraintName: 'FK_dictionary_revisions_creator',
  })
  creator: User | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  approvedBy: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'approvedBy',
    foreignKeyConstraintName: 'FK_dictionary_revisions_approver',
  })
  approver: User | null;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

@Entity('dictionary_forms')
@Index('IDX_dictionary_forms_search', ['normalizedText', 'revisionId'])
export class DictionaryForm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  revisionId: number;

  @ManyToOne(() => DictionaryRevision, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'revisionId',
    foreignKeyConstraintName: 'FK_dictionary_forms_revision',
  })
  revision: DictionaryRevision;

  @Column({ type: 'varchar', length: 200, ...unicodeColumn })
  text: string;

  @Column({ type: 'varchar', length: 512, ...unicodeColumn })
  normalizedText: string;

  @Column({ type: 'varchar', length: 8, nullable: true, ...unicodeColumn })
  script: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, ...unicodeColumn })
  type: string | null;
}

@Entity('dictionary_senses')
@Unique('UQ_dictionary_senses_revision_position', ['revisionId', 'position'])
export class DictionarySense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  revisionId: number;

  @ManyToOne(() => DictionaryRevision, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'revisionId',
    foreignKeyConstraintName: 'FK_dictionary_senses_revision',
  })
  revision: DictionaryRevision;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'text', ...unicodeColumn })
  definition: string;
}

@Entity('dictionary_sense_concepts')
@Index('IDX_dictionary_sense_concepts_concept', ['conceptId', 'senseId'])
export class DictionarySenseConcept {
  @PrimaryColumn({ type: 'int' })
  senseId: number;

  @ManyToOne(() => DictionarySense, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'senseId',
    foreignKeyConstraintName: 'FK_dictionary_sense_concepts_sense',
  })
  sense: DictionarySense;

  @PrimaryColumn({ type: 'int' })
  conceptId: number;

  @ManyToOne(() => DictionaryConcept, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'conceptId',
    foreignKeyConstraintName: 'FK_dictionary_sense_concepts_concept',
  })
  concept: DictionaryConcept;
}

@Entity('dictionary_publications')
export class DictionaryPublication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  previousPublicationId: number | null;

  @ManyToOne(() => DictionaryPublication, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'previousPublicationId',
    foreignKeyConstraintName: 'FK_dictionary_publications_previous',
  })
  previousPublication: DictionaryPublication | null;

  @Column({ type: 'int', nullable: true })
  createdBy: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'createdBy',
    foreignKeyConstraintName: 'FK_dictionary_publications_creator',
  })
  creator: User | null;

  @Column({ type: 'varchar', length: 500, ...unicodeColumn })
  reason: string;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

@Entity('dictionary_publication_entries')
@Unique('UQ_dictionary_publication_entries_revision', [
  'publicationId',
  'revisionId',
])
@Index('IDX_dictionary_publication_entries_revision', [
  'revisionId',
  'lexemeId',
])
export class DictionaryPublicationEntry {
  @PrimaryColumn({ type: 'int' })
  publicationId: number;

  @ManyToOne(() => DictionaryPublication, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'publicationId',
    foreignKeyConstraintName: 'FK_dictionary_publication_entries_publication',
  })
  publication: DictionaryPublication;

  @PrimaryColumn({ type: 'int' })
  lexemeId: number;

  @Column({ type: 'int' })
  revisionId: number;

  @ManyToOne(() => DictionaryRevision, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'revisionId',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'FK_dictionary_publication_entries_revision',
    },
    {
      name: 'lexemeId',
      referencedColumnName: 'lexemeId',
      foreignKeyConstraintName: 'FK_dictionary_publication_entries_revision',
    },
  ])
  revision: DictionaryRevision;
}

@Entity('dictionary_publication_state')
@Check('CHK_dictionary_publication_state_singleton', '`id` = 1')
export class DictionaryPublicationState {
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', nullable: true })
  currentPublicationId: number | null;

  @ManyToOne(() => DictionaryPublication, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'currentPublicationId',
    foreignKeyConstraintName: 'FK_dictionary_publication_state_current',
  })
  currentPublication: DictionaryPublication | null;
}

@Entity('dictionary_audit_logs')
@Index('IDX_dictionary_audit_logs_target', ['entityType', 'entityId', 'id'])
export class DictionaryAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'actorId',
    foreignKeyConstraintName: 'FK_dictionary_audit_logs_actor',
  })
  actor: User | null;

  @Column({ type: 'varchar', length: 64, ...unicodeColumn })
  action: string;

  @Column({ type: 'varchar', length: 32, ...unicodeColumn })
  entityType: string;

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'int', nullable: true })
  revisionId: number | null;

  @ManyToOne(() => DictionaryRevision, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'revisionId',
    foreignKeyConstraintName: 'FK_dictionary_audit_logs_revision',
  })
  revision: DictionaryRevision | null;

  @Column({ type: 'int', nullable: true })
  previousRevisionId: number | null;

  @ManyToOne(() => DictionaryRevision, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  @JoinColumn({
    name: 'previousRevisionId',
    foreignKeyConstraintName: 'FK_dictionary_audit_logs_previous_revision',
  })
  previousRevision: DictionaryRevision | null;

  @Column({ type: 'varchar', length: 128, ...unicodeColumn })
  requestId: string;

  @Column({ type: 'varchar', length: 500, nullable: true, ...unicodeColumn })
  reason: string | null;

  @CreateDateColumn(timestampColumn)
  createdAt: Date;
}

export const dictionaryEntities = [
  DictionaryLanguage,
  DictionarySource,
  DictionaryConcept,
  DictionaryLexeme,
  DictionaryRevision,
  DictionaryForm,
  DictionarySense,
  DictionarySenseConcept,
  DictionaryPublication,
  DictionaryPublicationEntry,
  DictionaryPublicationState,
  DictionaryAuditLog,
];
