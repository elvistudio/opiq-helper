# Педагогическое ревью teacher pack «Вода»

Это руководство позволяет проверить комплект по читаемым teacher/student материалам без чтения исходных YAML-планов. Шаблон не является evidence выполненного review.

## До review

1. Работайте с уже merged версией комплекта и подготовьте offline intake:

   ```sh
   npm run prepare:pedagogy-evidence -- \
     --pack teacher-packs/grade-5-science/water/materials-index.yaml \
     --kind teacher-review \
     --id grade-5-science-water-teacher-review-2026-08-01 \
     --date 2026-08-01 \
     --output tmp/water-review
   ```

2. Intake уже содержит актуальные fingerprint и pedagogical snapshot. Не
   переписывайте их вручную. Commit SHA — provenance; актуальность определяют
   fingerprint и все versioned pedagogy identities.
3. Убедитесь, что checklist содержит четыре lesson YAML, thematic plan, lesson
   DNA, selection/adaptation artifacts, teacher guides, student materials,
   answer keys, rubric, homeschool и parent materials. `materials-index.yaml`,
   evidence и readiness report исключены из reviewable fingerprint.
4. Распечатайте все student materials в чёрно-белом режиме.
5. Откройте и проверьте все прямые Opiq URL из teacher guide.
6. Прочитайте четыре lesson guides, answer keys, общую rubric и homeschool guide.
7. Отдельно проверьте безопасность практических работ, особенно урока 3.

## Что проверить

Оцените по шкале 1–5 и добавьте конкретное finding при любом существенном риске:

1. пригодность методов для возраста и предмета;
2. связность lesson pattern и выбранных фаз;
3. реалистичность timing, transitions, setup и cleanup;
4. когнитивную и общую продуктивно-языковую нагрузку;
5. качество русского предметного объяснения и bounded Estonian A1–A2 support;
6. retrieval, spacing, correction и self-explanation;
7. понятность teacher instructions и classroom feasibility;
8. homeschool clarity и реалистичную границу роли родителя;
9. differentiation, accessibility, assessment validity и разделение subject/language assessment;
10. autonomy, motivation/competence support и material availability;
11. safety и риск artificial/repetitive/inappropriate methods.

Scope считается полным, только если проверены teacher guide, все четыре lesson guides, student materials, answer keys, rubric, homeschool materials, safety и language level.

## Как фиксировать замечания

Заполните сгенерированный `intake.json`, нормализуйте его командой
`npm run normalize:pedagogy-evidence`, затем отдельно зарегистрируйте через
`npm run register:pedagogy-evidence -- ... --write`. Не записывайте имя
учителя: `reviewer.role` достаточно, а идентификация хранится снаружи
(`identity_storage: external`). Для исправлений используйте
`issue-resolution-template.yaml` и ссылки на commit/PR.

Severity `blocking` или `major` должна быть закрыта до approval. Для `approved_with_minor_notes` каждое открытое minor finding обязано иметь конкретный план и resolution reference.

## Решение

- `approved`: обязательный scope проверен, blocking/major замечаний нет, required changes закрыты.
- `approved_with_minor_notes`: комплект можно передавать в ограниченную апробацию, а все minor замечания имеют план.
- `changes_required`: до апробации нужны исправления и повторная проверка.
- `rejected`: пакет небезопасен или требует существенной переработки.

Даже `approved` не означает readiness. Classroom требует classroom-scoped
review и analysed classroom trial. Homeschool требует homeschool-scoped review
и отдельный analysed home trial. Оба evidence kinds должны совпадать с полным
current fingerprint и pedagogical snapshot.

## Privacy

Не включайте сведения об учениках. Для trial допустимы только агрегированные результаты. Автоматическая проверка деклараций не заменяет ручное чтение свободного текста.
