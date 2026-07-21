# Педагогическое ревью teacher pack «Вода»

Это руководство позволяет проверить комплект по читаемым teacher/student материалам без чтения исходных YAML-планов. Шаблон не является evidence выполненного review.

## До review

1. Работайте с уже merged версией комплекта и зафиксируйте SHA именно его содержимого:

   ```sh
   git rev-list -1 HEAD -- teacher-packs/grade-5-science/water ':(exclude)teacher-packs/grade-5-science/water/materials-index.yaml'
   ```

2. Запишите результат в `pack_commit_sha` будущей review record. `materials-index.yaml` исключён, потому что он хранит ссылку на evidence и его обновление не меняет проверяемые учебные материалы.
3. Распечатайте все student materials в чёрно-белом режиме.
4. Откройте и проверьте все прямые Opiq URL из teacher guide.
5. Прочитайте четыре lesson guides, answer keys, общую rubric и homeschool guide.
6. Отдельно проверьте безопасность практических работ, особенно урока 3.

## Что проверить

Оцените по шкале 1–5 и добавьте конкретное finding при любом существенном риске:

1. научную корректность;
2. соответствие возрасту;
3. реалистичность каждого 45-минутного тайминга;
4. понятность инструкций учителю;
5. понятность и печатную пригодность материалов ученику;
6. соответствие эстонского заявленному A1–A2;
7. достаточность русского предметного объяснения;
8. раздельное оценивание предмета и эстонского;
9. безопасность;
10. пригодность homeschool guide;
11. возможность провести урок без исходных YAML-файлов.

Scope считается полным, только если проверены teacher guide, все четыре lesson guides, student materials, answer keys, rubric, homeschool materials, safety и language level.

## Как фиксировать замечания

Скопируйте `teacher-review-template.yaml` в новый файл `records/teacher-review-YYYY-MM-DD.yaml`, замените placeholder ID и заполните только после фактической проверки. Не записывайте имя учителя в репозиторий: `reviewer.role` достаточно, а идентификация хранится снаружи (`identity_storage: external`). Для исправлений используйте `issue-resolution-template.yaml` и ссылки на commit/PR.

Severity `blocking` или `major` должна быть закрыта до approval. Для `approved_with_minor_notes` каждое открытое minor finding обязано иметь конкретный план и resolution reference.

## Решение

- `approved`: обязательный scope проверен, blocking/major замечаний нет, required changes закрыты.
- `approved_with_minor_notes`: комплект можно передавать в ограниченную апробацию, а все minor замечания имеют план.
- `changes_required`: до апробации нужны исправления и повторная проверка.
- `rejected`: пакет небезопасен или требует существенной переработки.

Даже `approved` не означает `classroom_ready`. Для этого дополнительно нужна analysed classroom trial на том же актуальном pack commit SHA.

## Privacy

Не включайте сведения об учениках. Для trial допустимы только агрегированные результаты. Автоматическая проверка деклараций не заменяет ручное чтение свободного текста.
