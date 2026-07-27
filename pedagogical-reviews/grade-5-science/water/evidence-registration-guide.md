# Evidence registration guide

1. Создайте bundle через `npm run prepare:pedagogy-evidence`, явно передав
   `--id` и `--date`.
2. Заполните JSON offline; YAML вручную не редактируется.
3. Проверьте `privacy-checklist.md`.
4. Нормализуйте через `npm run normalize:pedagogy-evidence`.
5. Исправьте все schema, identity, reference и privacy diagnostics.
6. Зарегистрируйте отдельным `npm run register:pedagogy-evidence -- ... --write`.
7. Запустите `npm run check:pedagogy-evidence` и
   `npm run check:pedagogy-readiness-report`.

Registration обновляет только excluded evidence link и derived readiness
report. Если algorithm, specification version, fingerprint value или file
count изменились, операция должна завершиться ошибкой и откатить evidence,
link и derived-report write.

Teacher review может покрывать classroom, homeschool или оба режима.
Classroom trial и home trial регистрируются отдельными records и не заменяют
друг друга.
