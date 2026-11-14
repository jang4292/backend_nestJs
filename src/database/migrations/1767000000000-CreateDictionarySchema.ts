import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumnOptions,
  TableForeignKeyOptions,
} from 'typeorm';

const generatedId = (): TableColumnOptions => ({
  name: 'id',
  type: 'int',
  isPrimary: true,
  isGenerated: true,
  generationStrategy: 'increment',
});

const createdAt = (): TableColumnOptions => ({
  name: 'createdAt',
  type: 'datetime',
  precision: 3,
  default: 'CURRENT_TIMESTAMP(3)',
});

const foreignKey = (
  name: string,
  columns: string[],
  referencedTableName: string,
  referencedColumnNames: string[] = ['id'],
  onDelete = 'RESTRICT',
): TableForeignKeyOptions => ({
  name,
  columnNames: columns,
  referencedTableName,
  referencedColumnNames,
  onDelete,
});

const tableOptions = {
  engine: 'InnoDB',
  charset: 'utf8mb4',
  collation: 'utf8mb4_bin',
};

const seedLanguages = [
  ['en', 'English', 'Latn', 1],
  ['ko', '한국어', 'Kore', 2],
  ['ja', '日本語', 'Jpan', 3],
  ['zh-Hans', '简体中文', 'Hans', 4],
  ['zh-Hant', '繁體中文', 'Hant', 5],
] as const;

async function createDictionaryTable(
  queryRunner: QueryRunner,
  table: Table,
): Promise<void> {
  for (const column of table.columns) {
    if (column.type === 'varchar' || column.type === 'text') {
      column.charset = 'utf8mb4';
      column.collation = 'utf8mb4_bin';
    }
  }
  await queryRunner.createTable(table);
  await queryRunner.query(
    `ALTER TABLE \`${table.name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
  );
}

export class CreateDictionarySchema1767000000000 implements MigrationInterface {
  name = 'CreateDictionarySchema1767000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_languages',
        columns: [
          { name: 'code', type: 'varchar', length: '35', isPrimary: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'script', type: 'varchar', length: '8' },
          { name: 'sortOrder', type: 'int' },
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_sources',
        columns: [
          generatedId(),
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'license', type: 'varchar', length: '200' },
          { name: 'attribution', type: 'varchar', length: '500' },
          { name: 'url', type: 'varchar', length: '1000', isNullable: true },
          createdAt(),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_concepts',
        columns: [
          generatedId(),
          { name: 'description', type: 'text' },
          createdAt(),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_lexemes',
        columns: [
          generatedId(),
          { name: 'languageTag', type: 'varchar', length: '35' },
          { name: 'currentVersion', type: 'int', default: 1 },
          createdAt(),
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_lexemes_language',
            ['languageTag'],
            'dictionary_languages',
            ['code'],
          ),
        ],
        indices: [
          {
            name: 'IDX_dictionary_lexemes_language',
            columnNames: ['languageTag', 'id'],
          },
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_revisions',
        columns: [
          generatedId(),
          { name: 'lexemeId', type: 'int' },
          { name: 'version', type: 'int' },
          { name: 'status', type: 'varchar', length: '20' },
          { name: 'lemma', type: 'varchar', length: '200' },
          { name: 'normalizedLemma', type: 'varchar', length: '512' },
          {
            name: 'partOfSpeech',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          { name: 'sourceId', type: 'int' },
          { name: 'createdBy', type: 'int', isNullable: true },
          {
            name: 'submittedAt',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          { name: 'approvedBy', type: 'int', isNullable: true },
          {
            name: 'approvedAt',
            type: 'datetime',
            precision: 3,
            isNullable: true,
          },
          createdAt(),
        ],
        uniques: [
          {
            name: 'UQ_dictionary_revisions_lexeme_version',
            columnNames: ['lexemeId', 'version'],
          },
          {
            name: 'UQ_dictionary_revisions_id_lexeme',
            columnNames: ['id', 'lexemeId'],
          },
        ],
        indices: [
          {
            name: 'IDX_dictionary_revisions_search',
            columnNames: ['normalizedLemma', 'id'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_revisions_lexeme',
            ['lexemeId'],
            'dictionary_lexemes',
          ),
          foreignKey(
            'FK_dictionary_revisions_source',
            ['sourceId'],
            'dictionary_sources',
          ),
          foreignKey(
            'FK_dictionary_revisions_creator',
            ['createdBy'],
            'users',
            ['id'],
            'SET NULL',
          ),
          foreignKey(
            'FK_dictionary_revisions_approver',
            ['approvedBy'],
            'users',
            ['id'],
            'SET NULL',
          ),
        ],
      }),
    );
    await queryRunner.query(
      "ALTER TABLE `dictionary_revisions` ADD CONSTRAINT `CHK_dictionary_revisions_status` CHECK (`status` IN ('draft', 'in_review', 'approved'))",
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_forms',
        columns: [
          generatedId(),
          { name: 'revisionId', type: 'int' },
          { name: 'text', type: 'varchar', length: '200' },
          { name: 'normalizedText', type: 'varchar', length: '512' },
          { name: 'script', type: 'varchar', length: '8', isNullable: true },
          { name: 'type', type: 'varchar', length: '40', isNullable: true },
        ],
        indices: [
          {
            name: 'IDX_dictionary_forms_search',
            columnNames: ['normalizedText', 'revisionId'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_forms_revision',
            ['revisionId'],
            'dictionary_revisions',
          ),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_senses',
        columns: [
          generatedId(),
          { name: 'revisionId', type: 'int' },
          { name: 'position', type: 'int' },
          { name: 'definition', type: 'text' },
        ],
        uniques: [
          {
            name: 'UQ_dictionary_senses_revision_position',
            columnNames: ['revisionId', 'position'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_senses_revision',
            ['revisionId'],
            'dictionary_revisions',
          ),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_sense_concepts',
        columns: [
          { name: 'senseId', type: 'int', isPrimary: true },
          { name: 'conceptId', type: 'int', isPrimary: true },
        ],
        indices: [
          {
            name: 'IDX_dictionary_sense_concepts_concept',
            columnNames: ['conceptId', 'senseId'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_sense_concepts_sense',
            ['senseId'],
            'dictionary_senses',
          ),
          foreignKey(
            'FK_dictionary_sense_concepts_concept',
            ['conceptId'],
            'dictionary_concepts',
          ),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_publications',
        columns: [
          generatedId(),
          { name: 'previousPublicationId', type: 'int', isNullable: true },
          { name: 'createdBy', type: 'int', isNullable: true },
          { name: 'reason', type: 'varchar', length: '500' },
          createdAt(),
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_publications_previous',
            ['previousPublicationId'],
            'dictionary_publications',
          ),
          foreignKey(
            'FK_dictionary_publications_creator',
            ['createdBy'],
            'users',
            ['id'],
            'SET NULL',
          ),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_publication_entries',
        columns: [
          { name: 'publicationId', type: 'int', isPrimary: true },
          { name: 'lexemeId', type: 'int', isPrimary: true },
          { name: 'revisionId', type: 'int' },
        ],
        uniques: [
          {
            name: 'UQ_dictionary_publication_entries_revision',
            columnNames: ['publicationId', 'revisionId'],
          },
        ],
        indices: [
          {
            name: 'IDX_dictionary_publication_entries_revision',
            columnNames: ['revisionId', 'lexemeId'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_publication_entries_publication',
            ['publicationId'],
            'dictionary_publications',
          ),
          foreignKey(
            'FK_dictionary_publication_entries_revision',
            ['revisionId', 'lexemeId'],
            'dictionary_revisions',
            ['id', 'lexemeId'],
          ),
        ],
      }),
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_publication_state',
        columns: [
          { name: 'id', type: 'int', isPrimary: true },
          { name: 'currentPublicationId', type: 'int', isNullable: true },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_publication_state_current',
            ['currentPublicationId'],
            'dictionary_publications',
          ),
        ],
      }),
    );
    await queryRunner.query(
      'ALTER TABLE `dictionary_publication_state` ADD CONSTRAINT `CHK_dictionary_publication_state_singleton` CHECK (`id` = 1)',
    );
    await createDictionaryTable(
      queryRunner,
      new Table({
        ...tableOptions,
        name: 'dictionary_audit_logs',
        columns: [
          generatedId(),
          { name: 'actorId', type: 'int', isNullable: true },
          { name: 'action', type: 'varchar', length: '64' },
          { name: 'entityType', type: 'varchar', length: '32' },
          { name: 'entityId', type: 'int' },
          { name: 'revisionId', type: 'int', isNullable: true },
          { name: 'previousRevisionId', type: 'int', isNullable: true },
          { name: 'requestId', type: 'varchar', length: '128' },
          { name: 'reason', type: 'varchar', length: '500', isNullable: true },
          createdAt(),
        ],
        indices: [
          {
            name: 'IDX_dictionary_audit_logs_target',
            columnNames: ['entityType', 'entityId', 'id'],
          },
        ],
        foreignKeys: [
          foreignKey(
            'FK_dictionary_audit_logs_actor',
            ['actorId'],
            'users',
            ['id'],
            'SET NULL',
          ),
          foreignKey(
            'FK_dictionary_audit_logs_revision',
            ['revisionId'],
            'dictionary_revisions',
          ),
          foreignKey(
            'FK_dictionary_audit_logs_previous_revision',
            ['previousRevisionId'],
            'dictionary_revisions',
          ),
        ],
      }),
    );

    await queryRunner.query(
      'INSERT INTO `dictionary_languages` (`code`, `name`, `script`, `sortOrder`) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
      seedLanguages.flat(),
    );
    await queryRunner.query(
      'INSERT INTO `dictionary_publication_state` (`id`, `currentPublicationId`) VALUES (1, NULL)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      'SELECT (SELECT COUNT(*) FROM `dictionary_sources`) + (SELECT COUNT(*) FROM `dictionary_concepts`) + (SELECT COUNT(*) FROM `dictionary_lexemes`) + (SELECT COUNT(*) FROM `dictionary_publications`) + (SELECT COUNT(*) FROM `dictionary_audit_logs`) AS `count`',
    )) as { count: number | string }[];
    const languages = (await queryRunner.query(
      'SELECT `code`, `name`, `script`, `sortOrder` FROM `dictionary_languages`',
    )) as {
      code: string;
      name: string;
      script: string;
      sortOrder: number;
    }[];
    const hasCustomLanguages = languages.some(
      (language) =>
        !seedLanguages.some(
          ([code, name, script, sortOrder]) =>
            language.code === code &&
            language.name === name &&
            language.script === script &&
            language.sortOrder === sortOrder,
        ),
    );
    if (Number(rows[0].count) > 0 || hasCustomLanguages) {
      throw new Error(
        'Dictionary migration cannot be reverted while dictionary data exists. Back up and remove it through an approved procedure first.',
      );
    }

    await queryRunner.dropTable('dictionary_audit_logs', true);
    await queryRunner.dropTable('dictionary_publication_state', true);
    await queryRunner.dropTable('dictionary_publication_entries', true);
    await queryRunner.dropTable('dictionary_publications', true);
    await queryRunner.dropTable('dictionary_sense_concepts', true);
    await queryRunner.dropTable('dictionary_senses', true);
    await queryRunner.dropTable('dictionary_forms', true);
    await queryRunner.dropTable('dictionary_revisions', true);
    await queryRunner.dropTable('dictionary_lexemes', true);
    await queryRunner.dropTable('dictionary_concepts', true);
    await queryRunner.dropTable('dictionary_sources', true);
    await queryRunner.dropTable('dictionary_languages', true);
  }
}
