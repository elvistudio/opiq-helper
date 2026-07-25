# Комплект блока «Вода»

Teacher-ready комплект для четырёх уроков 5 класса по `loodusõpetus`:
«Вода как вещество и состояния воды / Vesi kui aine ja vee olekud».

Русский язык используется для формирования понятий, научного объяснения и полных предметных ответов. Эстонский язык уровня A1–A2 используется для терминов, подписей, знакомых инструкций, рамок и коротких устных ответов. Это не языковое погружение и не упрощённая программа.

## Быстрый старт

1. Прочитайте [teacher-guide.md](teacher-guide.md).
2. Отметьте пункты в [preparation-checklist.md](preparation-checklist.md).
3. Откройте нужный файл в `lessons/` и распечатайте перечисленные в нём материалы из `student/`.
4. Проверяйте работы по ключу из `answers/` и общей [assessment-rubric.md](assessment-rubric.md).
5. Для семейного обучения используйте [homeschool-guide.md](homeschool-guide.md) и материалы из `parent/`.

Машинный реестр находится в [materials-index.yaml](materials-index.yaml). Он связывает материал с уроком, аудиторией, языками, печатностью, ключом ответа и provenance.

## Pedagogy integration

`pedagogy/integration-index.yaml` связывает content identity, classroom
selection request/decision, lesson DNA, stage timing, homeschool package,
parent guidance и weekly plan. Teacher-facing lesson files показывают
сгенерированную структуру в ограниченных marker-регионах; child-facing
материалы не показывают taxonomy/scoring. Четыре готовых домашних варианта
находятся в `homeschool/`, а подготовка устного ответа — в
`student/water-oral-answer-preparation.md`.

Committed classroom lesson DNA — единственный canonical selector output. Она
без изменений входит в homeschool request и имеет тот же digest в integration
index, decision и package. Точная production-привязка предметного и эстонского
assessment хранится отдельным overlay и не изменяет DNA.

Проверка воспроизводима без AI, сети, случайности и timestamp:

```bash
npm run generate:pedagogy-water-pilot -- --check
```

Classroom и homeschool используют одну scientific content identity. Это не
означает, что методика независимо проверена.

Каждая selected phase теперь имеет собственное реальное задание, привязанное к
конкретному student-файлу и, где нужен проверяемый ответ, к реальному key.
Activity/setup/cleanup/transition, reserve и non-DNA минуты полностью и без
пересечений делят каждый 45-минутный урок. Эстонское evidence A1–A2
переносится отдельно от русского предметного evidence.

Для домашнего урока 3 действует строгая политика
`pedagogy/homeschool/lesson-03-home-practical-policy.yaml`: только пассивное
таяние льда и капли на безопасной холодной поверхности, обязательное
разрешение учителя и присутствие взрослого, без чайника, плиты, открытого огня,
горячего сосуда и дегустации. Package, child/parent Markdown и machine policy
проверяются на одинаковую границу безопасности. Это не подтверждает домашнюю
апробацию.
Домашняя практика использует отдельный
`homeschool/lesson-03-passive-observation-sheet.md`, не использует школьную
таблицу температуры и не имеет ключа. Ключ урока остаётся только у отдельных
этапов проверки evidence и вывода после первой попытки. Ученические критерии и
рамки отделены от полных ответов; answer-leak guard проверяет student и
child-facing homeschool файлы.

## Независимая проверка и апробация

Для независимого review используйте [review guide](../../../pedagogical-reviews/grade-5-science/water/review-guide.md), а для урока — печатную [обезличенную форму наблюдения](../../../pedagogical-reviews/grade-5-science/water/anonymous-observation-form.md). Сначала вычислите content fingerprint и сохраните commit SHA только как provenance. Fingerprint охватывает связанные lesson/thematic YAML и реальные teacher/student/answer/parent материалы; rebase или squash не инвалидирует unchanged content. Пустые templates помогают оформить будущую запись, но не являются доказательством выполненного review или trial.

В репозитории разрешены только агрегированные наблюдения без имён, дат рождения, идентификаторов, адресов, контактов, фотографий, медицинских данных, персональных оценок и иного идентифицирующего текста. Автоматический validator проверяет декларации, но человек обязан прочитать свободный текст до commit.

## Честный статус готовности

- YAML-схемы полны: да.
- Содержание четырёх уроков подготовлено: да.
- Все заявленные файлы разрешаются: да.
- Ученические материалы пригодны для обычной чёрно-белой печати: да.
- Независимая проверка учителем-предметником: ожидается.
- Апробация в классе: не проводилась.
- Completed review records: 0.
- Analysed trial records: 0.
- `classroom_ready`: `false`.
- `readiness_status`: `teacher_pack_complete_pending_review`.

Комплект не доказывает полноту официальной программы и не завершает годовой курс issue #18.

## Provenance

Материалы самостоятельно составлены на основе проверенных целей water unit и кратких ссылок на канонические Opiq-страницы маршрута `grade-5-science`. Длинные фрагменты учебников не воспроизводятся.
