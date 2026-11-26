---
course: CSE 3101
title: Database Management Systems
semesters: [Spring 2021, Fall 2021, Spring 2022, Fall 2022, Spring 2023, Fall 2023, Spring 2024, Fall 2024]
files: [CSE3101_Spring21_Final.pdf, CSE3101_Fall21_Final.pdf, CSE3101_Spring22_Final.pdf, CSE3101_Fall22_Final.pdf, CSE3101_Spring23_Final.pdf, CSE3101_Fall23_Final.pdf, CSE3101_Spring24_Mid.pdf, CSE3101_Spring24_Final.pdf, CSE3101_Fall24_Mid.pdf, CSE3101_Fall24_Final.pdf]
total_questions_extracted: 53
total_rows_after_merge: 19
---

[QID: 001] Define super key, candidate key and primary key with one example of each.
Topic: Relational Model & Keys
Semesters: Spring 2021, Spring 2022, Spring 2023, Spring 2024

[QID: 002] Consider R(A, B, C, D, E) with the functional dependencies A → B, BC → D and D → E. Find every candidate key of R.<br>(a) Show the closure of each attribute set you test.<br>(b) Explain why each key you found is minimal.
Topic: Relational Model & Keys
Semesters: Fall 2022, Fall 2023, Fall 2024

[QID: 003] What is a foreign key? Explain referential integrity with an example.
Topic: Relational Model & Keys
Semesters: Fall 2021, Spring 2024, Fall 2024

[QID: 004] Normalize R(A, B, C, D, E) with the functional dependencies AB → C, C → D and D → E up to BCNF.<br>(a) Identify every partial and transitive dependency.<br>(b) Show each decomposition step.
Topic: Normalization
Semesters: Spring 2021, Fall 2022, Fall 2023, Fall 2024

[QID: 005] Define 3NF and BCNF. Give a relation that is in 3NF but not in BCNF.
Topic: Normalization
Semesters: Fall 2021, Spring 2023, Spring 2024

[QID: 006] Check whether decomposing R(A, B, C, D, E) into R1(A, B, C) and R2(C, D, E) is lossless and dependency preserving.
Topic: Normalization
Semesters: Spring 2022, Spring 2024

[QID: 007] For Employee(eid, name, dept, salary) write SQL to find:<br>(a) the second highest salary<br>(b) the departments with more than 5 employees<br>(c) the employees who earn more than their department average
Topic: SQL Queries
Semesters: Fall 2021, Spring 2022, Spring 2023, Spring 2024, Fall 2024

[QID: 008] Explain the difference between WHERE and HAVING with an example.
Topic: SQL Queries
Semesters: Spring 2021, Fall 2022, Spring 2024

[QID: 009] Write a SQL query with JOIN and GROUP BY that lists every course with its number of enrolled students.
Topic: SQL Queries
Semesters: Fall 2021, Fall 2023, Fall 2024

[QID: 010] [image] Convert the following ER diagram into relational schemas. Mark every primary and foreign key.
Topic: ER Modeling
Semesters: Fall 2021, Spring 2022

[QID: 011] Draw an ER diagram for a university library system. Show cardinality and participation constraints.
Topic: ER Modeling
Semesters: Spring 2021, Fall 2022

[QID: 012] Express in relational algebra:<br>(a) the students who took every course offered by CSE<br>(b) the instructors who teach no course
Topic: Relational Algebra
Semesters: Spring 2021, Fall 2021, Spring 2022, Spring 2023, Spring 2024

[QID: 013] What are the outer join operations? Show each one with an example.
Topic: Relational Algebra
Semesters: Fall 2022, Fall 2023, Fall 2024

[QID: 014] [image] Draw the precedence graph of the given schedule and test whether it is conflict serializable.
Topic: Transactions & Concurrency
Semesters: Spring 2023, Fall 2023, Spring 2024, Fall 2024

[QID: 015] Explain the ACID properties of a transaction with a bank transfer example.
Topic: Transactions & Concurrency
Semesters: Spring 2023, Fall 2024

[QID: 016] Explain two-phase locking. How can it lead to a deadlock?
Topic: Transactions & Concurrency
Semesters: Spring 2024

[QID: 017] Insert the keys 8, 5, 1, 7, 3, 12, 9, 6 into an empty B+ tree of order 3. Show the tree after every split.
Topic: Indexing & B+ Trees
Semesters: Fall 2022

[QID: 018] Compare dense and sparse indexing with a diagram of each.
Topic: Indexing & B+ Trees
Semesters: Spring 2022, Fall 2023

[QID: 019] Explain the steps of query processing with a block diagram.
Topic: Query Processing
Semesters: Spring 2021

## TOPIC: Relational Model & Keys
priority: VIP
total_asked: 10

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 001] | Final | Spring 2021, Spring 2022, Spring 2023, Spring 2024 | 10 | 4 |
| 2 | [QID: 002] | Final | Fall 2022, Fall 2023, Fall 2024 | 10 | 3 |
| 3 | [QID: 003] | Final | Fall 2021, Spring 2024, Fall 2024 | 10 | 3 |

## TOPIC: Normalization
priority: VIP
total_asked: 9

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 004] | Final | Spring 2021, Fall 2022, Fall 2023, Fall 2024 | 10 | 4 |
| 2 | [QID: 005] | Final | Fall 2021, Spring 2023, Spring 2024 | 10 | 3 |
| 3 | [QID: 006] | Final | Spring 2022, Spring 2024 | 10 | 2 |

## TOPIC: SQL Queries
priority: VIP
total_asked: 11

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 007] | Final | Fall 2021, Spring 2022, Spring 2023, Spring 2024, Fall 2024 | 10 | 5 |
| 2 | [QID: 008] | Final | Spring 2021, Fall 2022, Spring 2024 | 10 | 3 |
| 3 | [QID: 009] | Final | Fall 2021, Fall 2023, Fall 2024 | 10 | 3 |

## TOPIC: ER Modeling
priority: MEDIUM
total_asked: 4

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 010] | Final | Fall 2021, Spring 2022 | 10 | 2 |
| 2 | [QID: 011] | Final | Spring 2021, Fall 2022 | 10 | 2 |

## TOPIC: Relational Algebra
priority: HIGH
total_asked: 8

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 012] | Final | Spring 2021, Fall 2021, Spring 2022, Spring 2023, Spring 2024 | 15 | 5 |
| 2 | [QID: 013] | Final | Fall 2022, Fall 2023, Fall 2024 | 10 | 3 |

## TOPIC: Transactions & Concurrency
priority: HIGH
total_asked: 7

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 014] | Final | Spring 2023, Fall 2023, Spring 2024, Fall 2024 | 15 | 4 |
| 2 | [QID: 015] | Final | Spring 2023, Fall 2024 | 10 | 2 |
| 3 | [QID: 016] | Final | Spring 2024 | 15 | 1 |

## TOPIC: Indexing & B+ Trees
priority: MEDIUM
total_asked: 3

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 017] | Final | Fall 2022 | 15 | 1 |
| 2 | [QID: 018] | Final | Spring 2022, Fall 2023 | 15 | 2 |

## TOPIC: Query Processing
priority: LOW
total_asked: 1

| # | Question | Exam | Semester | Marks | Times |
|---|----------|------|----------|-------|-------|
| 1 | [QID: 019] | Final | Spring 2021 | 15 | 1 |

## VIP_MATRIX

| Topic | Times Asked | Avg Marks | Semesters Present | Last Asked | Priority |
|-------|-------------|-----------|-------------------|------------|----------|
| SQL Queries | 11 | 10.5 | Spring 2021, Fall 2021, Spring 2022, Fall 2022, Spring 2023, Fall 2023, Spring 2024, Fall 2024 | Fall 2024 | VIP |
| Relational Model & Keys | 10 | 10.0 | Spring 2021, Fall 2021, Spring 2022, Fall 2022, Spring 2023, Fall 2023, Spring 2024, Fall 2024 | Fall 2024 | VIP |
| Normalization | 9 | 10.0 | Spring 2021, Fall 2021, Spring 2022, Fall 2022, Spring 2023, Fall 2023, Spring 2024, Fall 2024 | Fall 2024 | VIP |
| Relational Algebra | 8 | 12.5 | Spring 2021, Fall 2021, Spring 2022, Fall 2022, Spring 2023, Fall 2023, Spring 2024, Fall 2024 | Fall 2024 | HIGH |
| Transactions & Concurrency | 7 | 14.3 | Spring 2023, Fall 2023, Spring 2024, Fall 2024 | Fall 2024 | HIGH |
| ER Modeling | 4 | 10.0 | Spring 2021, Fall 2021, Spring 2022, Fall 2022 | Fall 2022 | MEDIUM |
| Indexing & B+ Trees | 3 | 15.0 | Spring 2022, Fall 2022, Fall 2023 | Fall 2023 | MEDIUM |
| Query Processing | 1 | 15.0 | Spring 2021 | Spring 2021 | LOW |

## STUDY_PLAN

1. SQL Queries - in every final since 2021; practise the three-part Employee query.
2. Relational Model & Keys - in every final and both mids; candidate-key finding is a sure 10 marks.
3. Normalization - came in 7 of 8 finals but was skipped in Fall 2024, so it is due.
4. Relational Algebra - in almost every final; the division query keeps coming back.
5. Transactions & Concurrency - rising fast: in every final since Spring 2023, usually 15 marks.
6. ER Modeling - common before 2023, gone since; learn the ER-to-table steps once.
7. Indexing & B+ Trees - about every second final; B+ tree insertion is the usual question.
8. Query Processing - asked once in 2021; read only if time allows.

## SEMESTER_PAPERS

### Spring 2021
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | CSE3101_Spring21_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 011] | Final | 10 | CSE3101_Spring21_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 004] | Final | 10 | CSE3101_Spring21_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 008] | Final | 10 | CSE3101_Spring21_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 012] | Final | 15 | CSE3101_Spring21_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 019] | Final | 15 | CSE3101_Spring21_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Fall 2021
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 003] | Final | 10 | CSE3101_Fall21_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 010] | Final | 10 | CSE3101_Fall21_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 005] | Final | 10 | CSE3101_Fall21_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 007] | Final | 10 | CSE3101_Fall21_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 012] | Final | 15 | CSE3101_Fall21_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 009] | Final | 15 | CSE3101_Fall21_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Spring 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | CSE3101_Spring22_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 010] | Final | 10 | CSE3101_Spring22_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 006] | Final | 10 | CSE3101_Spring22_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 007] | Final | 10 | CSE3101_Spring22_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 012] | Final | 15 | CSE3101_Spring22_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 018] | Final | 15 | CSE3101_Spring22_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Fall 2022
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 002] | Final | 10 | CSE3101_Fall22_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 011] | Final | 10 | CSE3101_Fall22_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 004] | Final | 10 | CSE3101_Fall22_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 008] | Final | 10 | CSE3101_Fall22_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 013] | Final | 15 | CSE3101_Fall22_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 017] | Final | 15 | CSE3101_Fall22_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Spring 2023
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Final | 10 | CSE3101_Spring23_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 005] | Final | 10 | CSE3101_Spring23_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 007] | Final | 10 | CSE3101_Spring23_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 012] | Final | 10 | CSE3101_Spring23_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 015] | Final | 15 | CSE3101_Spring23_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 014] | Final | 15 | CSE3101_Spring23_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Fall 2023
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 002] | Final | 10 | CSE3101_Fall23_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 004] | Final | 10 | CSE3101_Fall23_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 009] | Final | 10 | CSE3101_Fall23_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 013] | Final | 10 | CSE3101_Fall23_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 014] | Final | 15 | CSE3101_Fall23_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 018] | Final | 15 | CSE3101_Fall23_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Spring 2024
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 001] | Mid | 10 | CSE3101_Spring24_Mid.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 005] | Mid | 10 | CSE3101_Spring24_Mid.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 008] | Mid | 10 | CSE3101_Spring24_Mid.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 1 | [QID: 003] | Final | 10 | CSE3101_Spring24_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 006] | Final | 10 | CSE3101_Spring24_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 007] | Final | 10 | CSE3101_Spring24_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 012] | Final | 10 | CSE3101_Spring24_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 016] | Final | 15 | CSE3101_Spring24_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |
| 6 | [QID: 014] | Final | 15 | CSE3101_Spring24_Final.pdf :: p2 :: 0.05,0.68,0.95,0.93 |

### Fall 2024
| # | Question | Exam | Marks | Source |
|---|----------|------|-------|--------|
| 1 | [QID: 003] | Mid | 10 | CSE3101_Fall24_Mid.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 004] | Mid | 10 | CSE3101_Fall24_Mid.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 009] | Mid | 10 | CSE3101_Fall24_Mid.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 1 | [QID: 002] | Final | 10 | CSE3101_Fall24_Final.pdf :: p1 :: 0.05,0.16,0.95,0.41 |
| 2 | [QID: 007] | Final | 10 | CSE3101_Fall24_Final.pdf :: p1 :: 0.05,0.42,0.95,0.67 |
| 3 | [QID: 013] | Final | 10 | CSE3101_Fall24_Final.pdf :: p1 :: 0.05,0.68,0.95,0.93 |
| 4 | [QID: 015] | Final | 10 | CSE3101_Fall24_Final.pdf :: p2 :: 0.05,0.16,0.95,0.41 |
| 5 | [QID: 014] | Final | 15 | CSE3101_Fall24_Final.pdf :: p2 :: 0.05,0.42,0.95,0.67 |

## PAPER_INVENTORY

| Semester | Exam | File | Questions on paper | Question numbers |
|----------|------|------|--------------------|------------------|
| Spring 2021 | Final | CSE3101_Spring21_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Fall 2021 | Final | CSE3101_Fall21_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Spring 2022 | Final | CSE3101_Spring22_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Fall 2022 | Final | CSE3101_Fall22_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Spring 2023 | Final | CSE3101_Spring23_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Fall 2023 | Final | CSE3101_Fall23_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Spring 2024 | Mid | CSE3101_Spring24_Mid.pdf | 3 | 1, 2, 3 |
| Spring 2024 | Final | CSE3101_Spring24_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
| Fall 2024 | Mid | CSE3101_Fall24_Mid.pdf | 3 | 1, 2, 3 |
| Fall 2024 | Final | CSE3101_Fall24_Final.pdf | 6 | 1, 2, 3, 4, 5, 6 |
