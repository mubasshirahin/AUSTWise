# Dashboard → Quick Stats ("At a glance")

> **Ei lekha kar jonno:** Jara coding jane na — shudhu website ta chalaay ba use kore.
> **Kon page:** Dashboard (`/`) er prothom tab — "At a glance"
> **Shesh update:** 21 October 2026

---

## 1. Ek nojore — jinish ta asole ki

Dashboard e dhuklei prothome "At a glance" namer ekta box dekhbe. Oi box e 4 ta choto ghor thake:

| Ghor | Ki dekhay |
|------|-----------|
| **Current CGPA** | Ekhon porjonto mot result (CGPA) |
| **Avg. Attendance** | Class e uposthitir gor (%) |
| **Pending Deadlines** | Samne jesob kaj/porikkha/assignment ache, tar shongkha |
| **Credits Completed** | Koto Credit shesh hoyeche |

**Sobcheye important kotha:** Ei box ta nijei kichu hisab kore na, nijei kichu lekhe o na. Tumi website er onno page e ja lekho, tar **motkotha** ekhane dekhay. Tai eta ekta "report card" — shudhu porar jonno.

- Kono ghore **click** korle oi tothyo jekhane lekha/thik kora hoy, shei page e niye jabe.
- Tothyo na thakle ghor ta khali (`0.00` ba `—`) dekhabe, sathe ekta button thakbe jate druto tothyo dite paro.

---

## 2. Char ta ghor — tothyo kothay theke ashe, kothay jay

### 2.1 Current CGPA

| Proshno | Uttor |
|---------|-------|
| **Ke tothyo dey?** | Chatro nijei |
| **Kothay dey?** | Analytics page → "CGPA Calculator" |
| **Kibhabe dey?** | Semester bachhe niye protita course er nam, Credit ar Grade lekhe, tarpor Save kore |
| **Ekhane ki dekhay?** | Shesh jei Semester er result deya hoyeche, shei porjonto mot CGPA |
| **Click korle kothay jay?** | Analytics page er CGPA Calculator |
| **Ar kothay ei tothyo use hoy?** | CGPA graph, "Semester Wise" talika, Department Heatmap |
| **Ke dekhte pare?** | Student, CR, SR, Alumni etc. **Faculty dekhte pare na** (ekhon bondho rakha ache) |

**Mone rakho:** Ekhane CGPA notun kore hisab hoy na. CGPA Calculator jokhon Save kore, tokhon je CGPA ber hoy — shetai ekhane dekhay. Tai CGPA Calculator e bhul Grade dile ekhane o bhul dekhabe.

---

### 2.2 Avg. Attendance (gor uposthiti)

| Proshno | Uttor |
|---------|-------|
| **Ke tothyo dey?** | Chatro nijei |
| **Kothay dey?** | Dashboard er "Attendance" tab |
| **Kibhabe dey?** | Routine er protita class er pashe "Present" ba "Absent" chape. Telegram diyeo kichu tothyo ashte pare |
| **Ekhane ki dekhay?** | Puro Semester er gor uposthiti (%) |
| **Click korle kothay jay?** | Attendance tab |
| **Ar kothay use hoy?** | Chatro er profile e "uposthitir har" hisebe joma thake |
| **Ke dekhte pare?** | Chatro nijei. Onno keu ei gor dekhte pare na |

**Tin ta jinish lage:**

1. **Routine** — kon din kon class
2. **Semester shuru tarikh** — Semester View e CR/Admin set kore
3. **Present/Absent er dag** — chatro nijei dey

**Sotorkota:** Ei gor ta shudhu tokhoni notun kore hisab hoy, jokhon tumi Attendance tab ta kholo. Shudhu Dashboard er prothom tab dekhle purono hisab tai dekhabe. Notun phone e dhukle tai kichukkhon `—` dekhate pare.

---

### 2.3 Pending Deadlines (samner kajer shongkha)

Ei ghor ta **dui rokom tothyo** jog kore:

1. **CR er deya kaj** — puro batch er jonno
2. **Nijer deya kaj** — shudhu nijer jonno

| Proshno | Uttor |
|---------|-------|
| **Ke tothyo dey?** | CR (batch er jonno), Admin (shobar jonno), sadharon chatro (nijer jonno) |
| **Kothay dey?** | Dashboard er "Semester View" tab |
| **Kibhabe dey?** | Tarikh, shomoy, course ar kajer nam likhe Add kore |
| **Ekhane ki dekhay?** | Bhobisshote jesob kajer tarikh ekhono asheni, shudhu tader shongkha |
| **Click korle kothay jay?** | Semester View |
| **Ar kothay use hoy?** | Dan pasher Deadline talika, ar Notification (ghonta) er barta |
| **Ke dekhte pare?** | Student nijer kaj; CR er kaj oi batch er sobai |

**Sotorkota:** Ei ghor er shongkha ar dan pasher Deadline talikar shongkha **sobshomoy milbe na**. Karon talika ta nijer batch er kaj alada kore dekhay, ar ei ghor ta sob kaj ekshathe gone. Eta ekhon ekta omil, niche bistarito ache.

---

### 2.4 Credits Completed

| Proshno | Uttor |
|---------|-------|
| **Ke tothyo dey?** | Chatro nijei |
| **Kothay dey?** | CGPA Calculator (CGPA er motoi eki jayga) |
| **Kibhabe hisab hoy?** | Jesob course e Grade deya hoyeche, shudhu segulor Credit jog hoy. Grade na deya course jog hoy na |
| **Click korle kothay jay?** | CGPA Calculator |
| **Ke dekhte pare?** | CGPA er motoi |

---

## 3. Tothyo asha-jawar shohoj chhobi

```
   [Analytics]
   CGPA Calculator
   (Grade lekha hoy)
          |
          v
   [Dashboard]
   Attendance tab   ------>  Quick Stats  ------> Analytics (CGPA graph, Heatmap)
   (Present/Absent)            box                Deadline talika
          ^                      |                Notification (ghonta)
          |                      |
   [Semester View]               +-----> click korle songlistho page e niye jay
   (CR/nijer kaj)

   [Admin Panel]  ---------->  box ta dekha jabe ki jabe na, ke dekhbe
```

**Shohoj bhashay:**

- **Tothyo ashe** — Analytics (CGPA, Credit), Attendance tab (uposthiti), Semester View (kaj/Deadline).
- **Tothyo jay** — Analytics er graph o Heatmap e, Deadline talika e, Notification e, ar Admin er shiddhanto onujayi kar Dashboard e dekha jabe.

---

## 4. Ke ki dekhte pare (Role onujayi)

| Byaboharkari | Quick Stats box | Ki dekhbe | Montobbo |
|--------------|-----------------|-----------|----------|
| **Student** | Hyan | Nijer CGPA, uposthiti, kaj, Credit | Shabhabik obostha |
| **CR** | Hyan | Nijer sob + batch er kaj jog korte pare | Kaj dile batch er sobai dekhe |
| **SR / Senior / VP / GS / Alumni** | Hyan | Nijer tothyo | Admin chaile bondho korte pare |
| **Faculty** | **Na** | Kichui na | Ekhon Admin bondho rekheche |
| **Guest** | Hyan, kintu khali | `0.00` / `—` ar "Sign in" button | Guest er nijer tothyo joma thake na |
| **Moderator** | Mishro | Kichu jaygay Admin er moto, kichu jaygay Student er moto | Niche somoshya hisebe lekha ache |
| **Admin** | **Na** | Box er bodole "Access Control" panel | Admin thik kore bakira ki dekhbe |

**Goponiyota:** Sadharon chatro onno chatro er CGPA, uposthiti ba kaj dekhte pare na. Protyeke shudhu nijer ta dekhe. Shudhu CR er deya kaj oi batch er sobai dekhe.

---

## 5. Ke ki kaj korte pare

| Kaj | Student | CR | Admin / Moderator |
|-----|---------|----|-------------------|
| Nijer Grade lekha | ✅ | ✅ | ✅ |
| Nijer uposthiti dagano | ✅ | ✅ | ✅ |
| Nijer jonno kaj jog kora | ✅ | ✅ | ✅ |
| Puro batch er jonno kaj jog kora | ❌ | ✅ | ✅ |
| Onner deya kaj muchano | ❌ | Shudhu nijer deya | ✅ |
| Quick Stats box chalu/bondho kora | ❌ | ❌ | ✅ |
| Kon Role box ta dekhbe thik kora | ❌ | ❌ | ✅ |

**Kibhabe Admin bondho kore:** Admin Panel → Dashboard → "At a glance" er pashe On/Off, othoba bhitore dhuke Role bachhe dey. Bondho korle sathe sathe shobar Dashboard theke box ta chole jay — kauke refresh korte hoy na.

---

## 6. Tothyo kokhon update hoy

| Poristhiti | Ki hoy |
|------------|--------|
| Eki phone e Grade/uposthiti bodlale | Sathe sathe Quick Stats bodlay |
| Onno phone ba laptop e bodlale | Koyek second er moddhe nijei nijei bodlay |
| Internet na thakle | Agher tothyo dekhay; internet firle thik hoye jay |
| Admin box bondho korle | Shobar Dashboard theke sathe sathe chole jay |
| Notun phone e prothombar dhukle | Agher tothyo ashte ektu shomoy lage |

---

## 7. Tothyo na thakle ki dekhay

| Obostha | Ja dekhabe |
|---------|------------|
| CGPA ekhono deya hoyni | `0.00` + "Open CGPA Calculator" button |
| Uposthiti deya hoyni | `—` |
| Kono kaj nei | `0` |
| Guest hisebe dhukeche | Khali ghor + "Sign in" button |
| Profile oshompurno | Upore ekta sotorkobarta ("Complete it here") |

---

## 8. Ekhono je je somoshya ache (shohoj bhashay)

| # | Somoshya | Ki hoy |
|---|----------|--------|
| 1 | **Eki computer e tothyo theke jawa** | Ekjon Logout korar por arekjon dhukle, agher joner CGPA kichukkhon dekha jete pare. Share kora computer e eta goponiyotar jhuki |
| 2 | **Uposthitir gor purono thaka** | Attendance tab na khulle gor update hoy na. Notun phone e `—` dekhay |
| 3 | **Uposthitir gor muche jawa** | Routine na thaka obosthay Attendance tab khulle purono gor ta o muche jete pare |
| 4 | **Deadline shongkha dui jaygay alada** | Quick Stats e ekta shongkha, dan pasher talika e arekta |
| 5 | **Purono Deadline thik korar shujog nei** | Purono poddhotite deya Deadline dekhay, kintu bodlano ba muchar button nei |
| 6 | **Leaderboard e shudhu nijer nam** | "Top 100" lekha thakleo bastobe shudhu nijer entry dekhay |
| 7 | **Admin ar Moderator er khomotay omil** | Kichu jaygay Moderator ke Admin er moto dhora hoy, kichu jaygay na |
| 8 | **"Sign in" button er bhul gontobbo** | Guest "Sign in" chaple asol Login page e na giye abar Dashboard e fire ashe |
| 9 | **Shongkha dekhanor rong nei** | CGPA/uposthiti kom hole lal/holud rong dekhanor kotha chilo, kintu sheta ekhono chalu hoyni |

---

## 9. Thikmoto kaj korche kina — shohoj porikkha

- [ ] Notun chatro hisebe dhuke Dashboard e 4 ta ghor dekha jay
- [ ] Analytics e ekta Semester er Grade dile CGPA ar Credit bodlay
- [ ] Onno phone e dhukle eki tothyo dekha jay
- [ ] Attendance tab e Present/Absent dile gor bodlay
- [ ] Semester View e bhobisshoter kaj dile Deadline shongkha bare
- [ ] Purono tarikher kaj dile shongkha bare na
- [ ] Kaj muchle shongkha kome
- [ ] Guest hisebe dhukle khali ghor ar "Sign in" dekhay
- [ ] Faculty hisebe dhukle box ta dekha jay na
- [ ] Admin bondho korle chatro er Dashboard theke box chole jay
- [ ] Admin abar chalu korle fire ashe
- [ ] Ghore click korle sothik page e niye jay
- [ ] Internet bondho kore refresh dile purono tothyo dekha jay

---

## 10. Sadharon proshno-uttor

**Proshno: Quick Stats e ami nijei kichu likhte parbo?**
Na. Eta shudhu dekhar jayga. Likhte hole Analytics, Attendance tab ba Semester View e jete hobe. Ghore click korlei sekhane niye jabe.

**Proshno: Onno chatro er CGPA dekhte parbo?**
Na. Protyeke shudhu nijer ta dekhe.

**Proshno: CR kaj dile kara dekhbe?**
Eki Department ar Semester er oi batch er chatrora. Onno batch ba onno Department dekhbe na.

**Proshno: Faculty ra keno dekhe na?**
Admin Panel theke Faculty er jonno box ta bondho rakha ache. Admin chaile chalu korte pare.

**Proshno: Admin er nijer Dashboard e box nei keno?**
Admin er kaj box dekha noy, shiddhanto neoya — ke ki dekhbe. Tai tar Dashboard e bodole Control Panel dekhay.

**Proshno: Internet na thakle ki hobe?**
Agherbar dekha tothyo dekhabe. Internet firle nijei nijei thik hoye jabe.

**Proshno: Tothyo kotokkhone onno device e jay?**
Sadharonoto koyek second. Eki device e sathe sathe.

---

## 11. Kon tothyo kon page e kaj e lage

| Tothyo | Jekhane lekha hoy | Jekhane dekha jay / kaj e lage |
|--------|-------------------|--------------------------------|
| CGPA | Analytics → CGPA Calculator | Quick Stats, CGPA graph, Semester Wise, Department Heatmap |
| Credit | Analytics → CGPA Calculator | Quick Stats, Semester er hisab |
| Uposthiti | Dashboard → Attendance tab | Quick Stats, chatro er profile |
| Nijer kaj | Dashboard → Semester View | Quick Stats, Deadline talika, Notification |
| CR er kaj | Dashboard → Semester View (CR) | Quick Stats, Deadline talika, Notification, batch er shobar calendar |
| Box chalu/bondho | Admin Panel → Dashboard | Quick Stats, Dashboard er tab, sidebar menu |

---

*Note: Ei lekha ta shohoj bhashay lekha. Code, file er nam ba technical biboron dorkar hole alada file e rakha ache — `docs/features/dashboard-quick-stats-technical.md`.*
