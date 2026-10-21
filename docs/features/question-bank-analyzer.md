# Question Bank Analyzer

> **Ei lekha kar jonno:** Jara coding jane na — shudhu website use kore ba chalaay.
> **Kon page:** Sidebar → **Question Bank** (`/question-bank-analyzer`)
> **Shesh update:** 21 October 2026

---

## 1. Ek nojore

Question Bank Analyzer ekta **past paper analyzer**. Tumi tomar AI (ChatGPT, Gemini etc.) ke purono question paper + syllabus dile, AI ekta report banay. Ei page sei report ta sundor kore dekhay:

1. **Kon topic beshi important** (VIP / High / Medium / Low)
2. **Kon semester e kon question esheche**
3. **Kivabe porbo** (study plan)
4. **Asol question paper er chhobi** ar **answer er chhobi** attach kora
5. **PDF** download kora

**Guruttopurno:** ei page nijei AI chale na. Tumi onno jaygay AI diye kaj koro, tar output ekhane paste koro. Tai ei page er mukhya "kacha mal" (raw data) ashe **tomar AI er answer theke**.

---

## 2. Kothay pabe

| Jayga | Ki kore |
|-------|---------|
| Sidebar → **Question Bank** | Sobcheye shohoj rasta |
| Search box | "Question Bank Analyzer" likhe |
| Mobile menu | Question Bank |
| Direct link | `/question-bank-analyzer` |
| Admin Panel → Access rules → **Question Bank** | Admin on/off kore, kon role dekhbe thik kore |
| Admin Panel → Page availability | Puro page on/off |

---

## 3. Kivabe kaj kore (step by step)

### Step 1 — Course details

Course code (e.g. `CSE 3101`) ar course title lekho. Sathe sathe ekta **master prompt** toiri hoy.

### Step 2 — AI te kaj

Prompt ta copy koro, tomar AI te niye jao. AI ke bolo:

- past paper gulo dile
- syllabus dile
- prompt er nirdesh onujayi output dite

AI jei answer dibe, seta ekta niirdisto format e hobe (Markdown).

### Step 3 — Output ekhane ano

- AI er answer **paste** koro, othoba
- `.md` / `.txt` file **upload** koro (protita file max 1 MB)
- Ekadhik file hole up/down diye krom thik koro
- **Preview** chapao

### Step 4 — Preview dekho

Dashboard, topic filter, VIP matrix, **semester-wise paper (age)**, **topic-wise question (niche)**, study plan — sob ek jaygay. Semester view er question e click korle niche topic view e sei question e chole jabe.

### Step 5 — Rakho ba download koro

| Button | Ki kore |
|--------|---------|
| **Save Preview** | Tomar account e save hoy (Saved tab) |
| **Download PDF** | Print dialog diye PDF |
| **Quick Download (image PDF)** | Chhobi-based PDF — print style fail hole o kaj kore |
| **Clear** | Course info, paste kora text ar file muche; **picture muche na** |

**Draft auto-save:** tumi ja lekho, browser nijei mone rakhe. Refresh dile o hariye jay na (ei device e).

---

## 4. Preview e ki ki ache

| Bhaga | Ki dekhay |
|-------|-----------|
| **Summary cards** | Koto topic, koto question, koto bar jiggesh kora hoyeche |
| **Topic filter** | Topic er button — click korle **dui view** ei oi topic e seemito hoy |
| **VIP matrix** | Topic gulo priority ar frequency onujayi rank kora |
| **Semester-wise view (age)** | Protita semester er asol paper, teacher je bhabe likhechen sei bhabe; pashe topic er nam; notun semester age |
| **Topic-wise view (niche)** | Topic onujayi group kora question; "Other questions" e sei question gulo jake AI topic e rakhe ni; notun semester age |
| **Study plan** | Kon topic age porbo, step by step |
| **Solved checklist** | Kon question pora shesh — tick |
| **Picture boxes** | Protita question ba sub-part er niche folded **Question & answer pictures**; click korle **Add Real Question Picture** ar **Add Answer Picture** |
| **Jump** | Semester view e question e click korle niche topic view e sei question e chole jay ar highlight kore |

Ei sob eki report er different bhasha — alada alada data na. Semester ar topic view er matched question **eki picture jayga** use kore.

---

## 5. Tothyo kothay theke ashe

| Tothyo | Kothay theke |
|--------|--------------|
| Course code, title | Tumi nijei lekho |
| Master prompt | Page nijei banay, tomar lekha course info diye |
| Question, topic, semester, marks, priority | **Tomar AI er answer** (paste ba .md file) |
| Semester question er topic nam | App nijei AI er topic ar paper question mile khuje ber kore |
| "Other questions" | AI jodi kono paper question topic e na dey, app nijei oi topic e rakhe |
| Question er asol chhobi | Tumi phone/computer theke upload koro |
| Answer er chhobi | Tumi upload koro |
| Picture er jayga (dui view share) | App nijei eki question er jonno eki jayga use kore |
| Solved tick | Tumi tick koro |
| Saved analysis | Tomar account er store |
| History | Protibar Preview korle nijei jome |

**Shohoj chhobi:**

```
Tomar AI (ChatGPT/Gemini)
        |
        |  Markdown answer
        v
  [Question Bank Analyzer page]
        |
        +--> Preview (semester age, topic niche, VIP, study plan)
        |
        +--> Tomar account (Saved + History + per-user pictures + ticks)
        |
        +--> PDF
```

---

## 6. Tothyo kothay jay

| Tothyo | Kothay jay |
|--------|------------|
| Analysis | Saved tab, History tab |
| Question/answer chhobi | Tomar account e copy hoy → onno device e fire ashe; same question er semester ar topic view eki picture dekhay |
| Solved tick | Account e jome, onno device e o dekhay |
| PDF | Tomar download folder |
| Topic/filter | Sudhu ei page e — onno page e jay na |

**Picture per user:** tomar add kora picture sudhu tumi dekho. Onno student, CR ba Admin tomar picture dekhe na.

**Guruttopurno:** ei analyzer er data onno kono page e jay na. Vault er **Question Bank** (upload kora paper) ekta **alada** feature — tar sathe ei analyzer er kono data connection nei.

Admin er access setting chara onno page ei feature ke affect kore na.

---

## 7. Ektai question dui jaygay keno dekhay

Ei ta bhujle baki sob somoshya bojha shohoj hobe.

AI ke bola hoy **dui rokom** output dite:

### (a) Topic block — merge kora

```
## TOPIC: Normalization
| # | Question | Semester |
| 1 | Version 1: Define normalization... Version 2: Explain 1NF... | Spring 2022, Fall 2024 |
```

Ekhane eki rokom question gulo **ek row** e merge kora hoy. Bhitore "Version 1 / Version 2" thake.

### (b) SEMESTER_PAPERS — jemon chhilo temon

```
### Fall 2024
| # | Question |
| 1 | Define normalization... |
| 2 | ... |

### Spring 2022
| # | Question |
| 1 | Explain 1NF... |
```

Ekhane **merge nei, repeat nei**. Je question paper e jei bar esheche, sei bar likha.

### Tar mane

- Eki question **topic list** e ekbar (merged)
- **semester list** e paper onujayi ekbar ba ekadhik bar (repeat)
- App ekhon duita ke **eki question** hisebe chine — position diye na, **lekha mile** diye
- Tai **ek view e picture add korle arek view e o dekhay** (nijer account e)
- Tai **filter** dui view e lage
- Tai **a/b part** dui view e alada block e dekhay
- Jodi AI kono paper question topic block e likhte bhule jay, app take **Other questions** e rakhe — hariye jay na

**Caveat:** AI jodi eki question er wording purai alada likhe, app milate na pare. Tokhon question ta Other e thake — hariye jay na, kintu topic group e thake na.

---

## 8. Tomar 6 ta dabi — ekhon ki hoy

| # | Dabi | Ekhon |
|---|------|-------|
| 1 | Semester view e question er pashe topic | ✅ Hyan — protita row e topic chip |
| 2 | Filter korle semester view o filter hobe | ✅ Hyan — dui view e lage |
| 3 | Prottek question e question + answer picture | ✅ Hyan — protita sub-part eo alada |
| 4 | Ek jaygay add korle sob jaygay add hobe | ✅ Hyan — matched question er khetre |
| 5 | Recent year age dekhabe | ✅ Hyan — semester ar topic question dui jaygay |
| 6 | a/b part alada box | ✅ Hyan — dui view ar print e |

---

### 8.1 Dui view er question kivabe mile

App question ke **position** diye na, **lekha** diye mile:

- chhoto-boro hater farak nei
- punctuation, extra space, "Version 1:" ei sob bad jay
- `2.a)` ar `(a)` ke eki part dhora hoy
- age **hubohu eki lekha** khuje dekhe; na mille **86% ba tar beshi mil** hole eki question dhore

Mile gele semester row ar topic row **eki question**. Na mille paper question ta **Other questions** e jay.

**Caveat:** AI jodi eki question er wording purai alada likhe, app milate na pare. Tokhon question ta Other e thake — hariye jay na, kintu topic group e thake na.

---

### 8.2 Ek jaygay picture add korle dui jaygay

- Picture **per user** — tomar add kora picture onno student dekhe na.
- Matched question er khetre semester view ar topic view **eki picture jayga** use kore.
- Tai je kono view e add korle dui view e dekhay.
- Answer picture er khetre o eki.
- Purono analysis e semester view e add kora picture gulo o matched row e dekhay; notun add gulo shared jaygay jome.

**Caveat:** Jodi question mile na, seta Other e jay; tokhon semester row ar Other row eki picture jayga pay — tai picture dui jaygay dekhbe.

---

### 8.3 Other questions

AI jodi kono paper question topic block e na dey, app:

- take **Other questions** namer topic e rakhe
- eki wording bar bar ashle ek row kore, semester gulo ekshathe dekhay
- semester view ar Other view e same picture jayga dey

Tai **paper er kono question hariye jay na** — screen ar print/PDF dui jaygay i Other questions ashe.

---

### 8.4 Semester question e click korle

- Click korle page niche **topic view** e sei question e chole jay
- Topic ta nijei khele jay (accordion open)
- Question ta kichukkhon **highlight** kore
- Jodi topic filter oi topic ke lukiyechilo, app filter ta clear kore dey

---

### 8.5 Recent year age

- Semester card: notun age (Fall 2024 → Spring 2024 → ...)
- Topic view: protita topic er bhitore question notun semester age
- Topic gulo nijei priority onujayi sajano (VIP → High → ...)

---

### 8.6 a/b part alada box

- `2)a)`, `2)b)` ba `(a)`, `(b)` alada line e thakle app protita part ke **alada block** kore
- Protita part er nijer **question picture** ar **answer picture** box
- Dui view ar print/PDF e same bhabe dekhay

**Caveat:** AI jodi a/b ek line e likhe dey, app split na kore ek block e rakhte pare. AI output e alada line e likhano best.

---

### 8.7 Picture area folded thake

- Protita question/part er picture area **default bondho**
- Summary te dekhay: koto file ache, ba "Add", ba "Needed"
- "Needed" mane: AI er source e figure chilo, kintu tumi ekhono question picture dao ni
- Click korle khola jay, tarpor file add/remove kora jay

---

## 9. Ke ki korte pare (CRUD)

| Kaj | Kothay | Ke korte pare |
|-----|--------|----------------|
| Course info + AI output deya | Analyzer tab | Sob byaboharkari |
| Preview banano | Analyzer tab | Sob byaboharkari |
| Question text bodlano | — | **Kew na** (AI output bodle abar Preview) |
| Question picture add/remove | Preview — je kono view | Nijer account e nijei |
| Answer picture add/remove | Preview — je kono view | Nijer account e nijei |
| Semester question theke topic view e jump | Preview | Sob byaboharkari |
| Solved tick | Preview | Nijei |
| Merge / unmerge | Topic view | Nijei |
| Save / unsave | Analyzer | Nijei |
| Saved analysis delete | Saved tab | Nijei |
| History delete | History tab | Nijei |
| Sob saved clear | Saved tab | Nijei |
| PDF download | Analyzer / Saved | Nijei |
| Feature on/off | Admin Panel | Admin / Moderator |
| Kon role dekhbe | Admin Panel | Admin / Moderator |

**Note:**

- Question text direct edit kora jay na. Bhul thakle AI output change kore abar **Preview** dite hobe.
- **Clear** korle draft jay, kintu **picture ar saved analysis** jay na.
- Merge sudhu topic view ke bodlay; semester view er raw copy alada thake. Matched question er picture sharing merge er por o thake.
- Semester question e click korle sudhu chokh niche topic view e jay — kono data bodlay na.

---

## 10. Role access

| Byaboharkari | Page dekhe? | Ki korte pare |
|--------------|-------------|----------------|
| **Student** | Hyan | Nijer analysis, chhobi, save, history |
| **CR / SR / Senior / VP / GS** | Hyan | Student er motoi — kono extra shared power nei |
| **Faculty** | Hyan (Admin chaile bondho) | Student er motoi |
| **Guest** | Hyan | Analyze korte pare; **save/history/onno device e rakha pare na** |
| **Moderator** | Hyan | Admin er motoi sob dekhte ar control korte pare |
| **Admin** | Hyan | Sob + feature on/off + role control |

**Guruttopurno:**

- Ei feature er data **per user**. Ekjon student er add kora chhobi ba saved analysis onno keu dekhbe na.
- Guest analyze korte ar nijer device e picture add korte pare, kintu account e save/history/sync nei.
- CR er kono special shared question bank nei.
- Admin Panel → **Access rules → Question Bank** theke on/off ar role hide kora jay.
- Admin Panel → **Page availability** theke puro page bondho kora jay.
- Admin/moderator er upor ei gate lage na — tara sob somoy dekhe.

---

## 11. Data kothay joma thake

| Jinish | Kothay | Onno device e jay? |
|--------|--------|--------------------|
| Course info + paste kora text | Ei device | Na |
| Upload kora .md file | Ei device | Na |
| Preview | Ei device | Na (save na korle) |
| Question/answer chhobi | Device + account copy | Hyan (login thakle); same question er dui view eki picture dekhay |
| Picture er jayga | Course + question | Matched hole semester ar topic view eki jayga |
| Solved tick | Account + device copy | Hyan |
| Saved analysis | Account | Hyan |
| History | Account | Hyan |

**Sotorkota — eki browser e account bodol:**

Draft, tick ar chhobir **device e rakha copy** account onujayi alada kora na. Tai eki browser e ekjon logout kore arekjon login korle:

- purono draft text dekha jete pare
- kichu khetre purono tick ba chhobi o dekha jete pare
- share kora computer e eta goponiyotar jhuki

**Limit:**

- Saved analysis: **20 ta**
- History: **20 ta** (protibar Preview korle nijei jome)
- `.md` / `.txt` file: **1 MB** each
- Chhobi: **8 MB** each, 1600 pixel e chhoto hoy
- Onno attachment: **25 MB** each

**Offline:**

- Analyze kora jay
- Chhobi device e jome
- Account e pathano fail korle "ei device e ache" message ashe
- Internet firle abar account e jome

---

## 12. Somoshya ar jhuki (simple)

| # | Somoshya | Ki hoy |
|---|----------|--------|
| 1 | **AI wording alada** | Match na hole question **Other questions** e jay; hariye jay na, kintu topic group e thake na |
| 2 | **Onek mil khola wording** | Bhul question er sathe link hote pare (rare) |
| 3 | **Chhobi shared na** | Onno student tomar chhobi dekhe na (per user) |
| 4 | **Question text edit nei** | AI output bodle abar Preview dite hoy |
| 5 | **Saved copy purono text** | Save korar por analysis bodlale saved text bodlay na; picture live |
| 6 | **Account e pathano fail** | Chhobi sudhu ei device e theke jete pare |
| 7 | **Guest save pare na** | Login chara saved/history/sync nei |
| 8 | **AI format er upor nirbhor** | Bhul format hole preview khali |
| 9 | **1 MB file limit** | Boro .md file gele bhag korte hoy |
| 10 | **20 entry limit** | Purono saved/history nijei sore jay |
| 11 | **Filter reset** | Notun Preview dile filter abar shuru theke |
| 12 | **Merge sudhu topic view** | Semester view raw-i thake; picture sharing matched question e thake |
| 13 | **Count alada** | Merged count ar raw paper count sob somoy mile na; Other add hole count barhe |
| 14 | **Account bodol e purono copy** | Eki browser e notun account e purono draft/tick/chhobi dekha jete pare |
| 15 | **Purono saved analysis** | Raw paper section na thakle semester view topic group theke bane; teacher er asol wording nao thakte pare |
| 16 | **Picture area folded** | Notun user "Add" na dekhe summary dekhe; expand korte hobe |

---

## 13. Ki thik ache ar ki baki

**Thik ache:**

- Semester question er pashe topic chip
- Topic filter dui view e lage
- Je kono view e picture add korle dui view e dekhay
- Purono semester picture matched row e dekhay
- a/b part dui view ar print e alada
- Recent semester ar recent question age
- Semester question theke topic view e jump + highlight
- "Other questions" e hariye jawa paper question — screen ar print dui jaygay
- Picture area default folded

**Baki / decision:**

1. **Manual link/unlink (semester ↔ topic)** — AI wording onek alada hole app mile na; tokhon manually jukto korar option nei. Ekhon shudhu automatic text match.
2. **Shared question bank picture** — ekhon per user; eta deliberate. Sobai ek question er picture dekhte chaile data rakhar niyom bodlate hobe.
3. **Account-scoped device cache** — eki browser e account bodol e purono draft/tick/picture dekha jete pare. Device copy account onujayi alada kora baki.
4. **Old saved analyses** — raw paper section na thakle semester view topic group theke bane; teacher er asol wording nao thakte pare.
5. **AI format** — part split nishchit korte AI ke alada line e likhate hobe.

---

## 14. Test checklist

Screen:

- [x] Raw paper wala analysis e semester view e topic chip dekhay
- [x] Topic filter dui view e lage
- [x] Semester view e picture add korle topic view e dekhay
- [x] Topic view e add korle semester view e dekhay
- [x] Answer picture dui view e dekhay
- [x] Notun semester ar notun question age dekhay
- [x] a/b part dui view e alada block e dekhay
- [x] PDF e per-part question + answer picture ashe
- [x] Semester question e click korle topic view e jump + highlight kore
- [x] Paper question topic e na thakle Other questions e ashe
- [x] Picture area default folded thake
- [x] Merge korle topic view bodlay, semester view raw thake
- [x] Clear korle draft jay, chhobi thake

Print/PDF:

- [x] Print/PDF er topic-wise section e Other questions ashe

Baki / manual check:

- [ ] Guest hisebe save korle "login koro" type message ashe
- [ ] Onno account e login korle purono device copy na dekhay (known risk)

---

## 15. Sadharon proshno-uttor

**Proshno: Eki question duibar keno dekhay?**
AI dui bhabe dey — topic block (merge kora) ar raw paper (jemon chhilo temon). App duita ke **eki question** hisebe chine, kintu dui bhabe dekhay: semester-wise age, topic-wise niche.

**Proshno: Ek jaygay chhobi add korle arek jaygay keno jay na?**
Normal matched question e **jay**. Jodi na jay, dui question er wording mile ni — question ta **Other questions** e ache kina dekho. Oi khetre semester row ar Other row er picture jayga alada na, eki.

**Proshno: Topic filter dile semester view bodlay?**
Hyan. Filter ekhon **dui view** e lage.

**Proshno: Chhobi ki sobai dekhte pare?**
Na. Chhobi **per user**. Tomar add kora chhobi onno student, CR ba Admin dekhe na.

**Proshno: Question text bhul hole ki korbo?**
AI output e text ta thik koro, abar Preview dao. Page er bhitore direct edit nei.

**Proshno: Merge korle ki hoy?**
Topic view e ek row hocche, bhitor e Version 1/2 thake. Semester view er raw copy bodlay na. Matched question er picture sharing thake.

**Proshno: "Other questions" ki?**
AI jodi kono paper question topic block e na dey, app take Other questions e rakhe. Eki wording bar bar ashle ek row kore, semester gulo ekshathe dekhay. Tai question hariye jay na.

**Proshno: "Needed" mane ki?**
AI er source e figure chilo, kintu tumi ekhono question picture add koro ni. Picture add korle "Needed" chole jay.

**Proshno: Semester question e click korle ki hoy?**
Page niche topic view e sei question e jay, topic khele jay, question highlight kore. Filter oi topic ke lukiyechilo to filter clear hoy.

**Proshno: AI chara use kora jay?**
Na. Page ta AI er deya niirdisto format er text porte pare, nijei question banay na.

**Proshno: Koto ta save rakha jay?**
Saved 20 ta, History 20 ta. Purono gulo nijei sore jay.

**Proshno: Offline e kaj kore?**
Analyze ar chhobi device e kora jay. Save/history/onno device e rakhar jonno internet + login lagbe.

**Proshno: Print/PDF e sob question ashe?**
Hyan. Semester-wise ar topic-wise dui jaygay i sob paper question ashe. AI jake topic e rakhe ni, seta print er **Other questions** e dekhay.

**Proshno: a/b part alada hocche na keno?**
AI jodi `2.a)`, `2.b)` alada line e na likhe ek line e likhe dey, app split na korte pare. AI output e alada line e likhao.

---

## 16. Ek line e

**Ja thik ache:** AI analysis, topic priority, VIP matrix, study plan, semester view age, topic view niche, dui view er eki picture, dui view er filter, a/b part, jump, Other questions (screen + print), save/history, PDF.
**Ja baki:** manual link for mismatched wording, shared question bank picture (ekhon deliberate per user), account-scoped device cache.

---

*Note: ei doc ta shohoj bhashay lekha — code, file name ba line number nei. Developer er jonno alada technical note dorkar hole bolo.*
