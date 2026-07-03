const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const damagedPattern = /[\u00c3\u00c2\ufffd]|\u00e2[\u0080-\u20ac]|\u00f0\u0178/;

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'character')
    ORDER BY table_name, ordinal_position
  `;
  const failures = [];

  for (const column of columns) {
    const tableName = column.table_name;
    const columnName = column.column_name;
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id::text AS id, ${JSON.stringify(columnName)}::text AS value
       FROM ${JSON.stringify(tableName)}
       WHERE ${JSON.stringify(columnName)} IS NOT NULL
       LIMIT 5000`,
    );

    for (const row of rows) {
      if (typeof row.value === 'string' && damagedPattern.test(row.value)) {
        failures.push(`${tableName}.${columnName}(${row.id}): ${row.value}`);
      }
    }
  }

  if (failures.length) {
    console.error('Se detectaron textos corruptos en PostgreSQL:');
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('Base de datos verificada: textos sin caracteres corruptos.');
}

main()
  .catch((error) => {
    console.error('No se pudo verificar la base de datos:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
