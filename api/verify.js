// api/verify.js
// Vérification via hash (nouveau) + plaintext (fallback) + rate limiting

import { hashCode } from './_crypto.js';
import { getClientIp } from './_turnstile.js';

// ============================================================
// 🗺️ خريطة شاملة: المدن والبلديات الجزائرية -> الولايات
// ============================================================
const CITY_TO_WILAYA = {
  // 01 - أدرار
  "adrar": "أدرار", "reggane": "أدرار", "aoulef": "أدرار", "tsabit": "أدرار", "fenoughil": "أدرار", "zaouiet konta": "أدرار", "tamekten": "أدرار", "tamest": "أدرار", "tit": "أدرار", "in zghmir": "أدرار", "sali": "أدرار", "akabli": "أدرار", "oulad said": "أدرار", "bordj badji mokhtar": "أدرار",
  // 02 - الشلف
  "chlef": "الشلف", "tenes": "الشلف", "tadjena": "الشلف", "boukadir": "الشلف", "oued fodda": "الشلف", "brena": "الشلف", "chorfa": "الشلف", "ouled fares": "الشلف", "taougrit": "الشلف", "abou el hassan": "الشلف", "ain merane": "الشلف", "beni bouattab": "الشلف", "el karimia": "الشلف", "harchoun": "الشلف", "moussadek": "الشلف", "oued sly": "الشلف", "sendjas": "الشلف", "sobgah": "الشلف", "tougourt": "الشلف", "zeccar": "الشلف",
  // 03 - الأغواط
  "laghouat": "الأغواط", "aflou": "الأغواط", "ksar el hirane": "الأغواط", "hassi r'mel": "الأغواط", "ain madhi": "الأغواط", "brida": "الأغواط", "gueltat sidi saad": "الأغواط", "hassi delaa": "الأغواط", "oued morra": "الأغواط", "sidi makhlouf": "الأغواط", "tadjemout": "الأغواط", "tadjrouna": "الأغواط",
  // 04 - أم البواقي
  "oum el bouaghi": "أم البواقي", "ain beida": "أم البواقي", "ain m'lila": "أم البواقي", "ain fakroun": "أم البواقي", "meskiana": "أم البواقي", "sigus": "أم البواقي", "souk naamane": "أم البواقي", "ain kercha": "أم البواقي", "behir chergui": "أم البواقي", "bir chouhada": "أم البواقي", "dhalaa": "أم البواقي", "el amri": "أم البواقي", "el belala": "أم البواقي", "el fedjoudj": "أم البواقي", "ksar sbahi": "أم البواقي", "ouled gacem": "أم البواقي", "ouled hamla": "أم البواقي", "rahia": "أم البواقي", "zorg": "أم البواقي",
  // 05 - باتنة
  "batna": "باتنة", "barika": "باتنة", "merouana": "باتنة", "ain touta": "باتنة", "tazoult": "باتنة", "arris": "باتنة", "menaa": "باتنة", "ras el aioun": "باتنة", "chemora": "باتنة", "n'gaous": "باتنة", "seggana": "باتنة", "timgad": "باتنة", "bitam": "باتنة", "bouzina": "باتنة", "el hassi": "باتنة", "fesdis": "باتنة", "foum toub": "باتنة", "ghassira": "باتنة", "guigba": "باتنة", "hidoussa": "باتنة", "ichellalen": "باتنة", "inoughissen": "باتنة", "kimmel": "باتنة", "ksar bellezzma": "باتنة", "larbaa": "باتنة", "lazrou": "باتنة", "lemcene": "باتنة", "maafa": "باتنة", "oulad ammar": "باتنة", "oulad fadel": "باتنة", "oulad sellam": "باتنة", "rahbat": "باتنة", "seriana": "باتنة", "theniet el abed": "باتنة", "tighanimine": "باتنة", "tigharghar": "باتنة", "tilatou": "باتنة", "taxlent": "باتنة", "zana el beida": "باتنة",
  // 06 - بجاية
  "bejaia": "بجاية", "akbou": "بجاية", "kherrata": "بجاية", "sidi aich": "بجاية", "amizour": "بجاية", "el kseur": "بجاية", "timezrit": "بجاية", "tichy": "بجاية", "aokas": "بجاية", "adekar": "بجاية", "barbacha": "بجاية", "beni djellil": "بجاية", "beni ksila": "بجاية", "beni maouche": "بجاية", "chemini": "بجاية", "darguina": "بجاية", "draa el kaid": "بجاية", "fenaia ilmaten": "بجاية", "ferraoun": "بجاية", "ifri ouzellaguene": "بجاية", "iquelban": "بجاية", "kendira": "بجاية", "melbou": "بجاية", "oued ghir": "بجاية", "seddouk": "بجاية", "semaoun": "بجاية", "sidi ayad": "بجاية", "souk el tenine": "بجاية", "taourirt ighil": "بجاية", "taskriout": "بجاية", "tazmalt": "بجاية", "tinebdar": "بجاية",
  // 07 - بسكرة
  "biskra": "بسكرة", "toulga": "بسكرة", "sidi okba": "بسكرة", "zeribet el oued": "بسكرة", "ould djellal": "بسكرة", "bordj ben azzouz": "بسكرة", "chemtou": "بسكرة", "el hdjira": "بسكرة", "el outaya": "بسكرة", "foughala": "بسكرة", "jamel": "بسكرة", "liana": "بسكرة", "lioua": "بسكرة", "m'chouneche": "بسكرة", "mechouneche": "بسكرة", "m'lili": "بسكرة", "mlili": "بسكرة", "ouled adjel": "بسكرة", "ras el miaad": "بسكرة", "sidi okba": "بسكرة", "toulga": "بسكرة", "zeribet el oued": "بسكرة",
  // 08 - بشار
  "bechar": "بشار", "kenadsa": "بشار", "ababsa": "بشار", "beni ounif": "بشار", "boukais": "بشار", "el ouata": "بشار", "iguer": "بشار", "kerzaz": "بشار", "lahmar": "بشار", "mogheul": "بشار", "tabelbala": "بشار", "taghit": "بشار", "tamtert": "بشار", "beni abbes": "بشار",
  // 09 - البليدة
  "blida": "البليدة", "boufarik": "البليدة", "larbaa": "البليدة", "bougara": "البليدة", "mouzaia": "البليدة", "ouled yaich": "البليدة", "meftah": "البليدة", "beni mered": "البليدة", "soumaa": "البليدة", "ain romana": "البليدة", "ben khellil": "البليدة", "beni tamou": "البليدة", "bouarfa": "البليدة", "bouinan": "البليدة", "chebli": "البليدة", "chiffa": "البليدة", "djebabra": "البليدة", "el affroun": "البليدة", "guediara": "البليدة", "hammam melouane": "البليدة", "ouled selam": "البليدة", "souhane": "البليدة",
  // 10 - البويرة
  "bouira": "البويرة", "lakhdaria": "البويرة", "sour el ghozlane": "البويرة", "ain bessem": "البويرة", "bir ghbalou": "البويرة", "bordj okhriss": "البويرة", "chorfa": "البويرة", "dechmia": "البويرة", "dirrah": "البويرة", "djebahia": "البويرة", "el adjiba": "البويرة", "el hachimia": "البويرة", "el khabouzia": "البويرة", "el mokrani": "البويرة", "guerrouma": "البويرة", "h'ssein": "البويرة", "haizer": "البويرة", "kadiria": "البويرة", "maala": "البويرة", "mezdour": "البويرة", "oudjana": "البويرة", "raouraoua": "البويرة", "ridane": "البويرة", "saoula": "البويرة", "taghzout": "البويرة", "taguedit": "البويرة", "z'barbar": "البويرة",
  // 11 - تمنراست
  "tamanrasset": "تمنراست", "in salah": "تمنراست", "in guezzam": "تمنراست", "ablessa": "تمنراست", "idles": "تمنراست", "tazrouk": "تمنراست", "tinzaouaten": "تمنراست",
  // 12 - تبسة
  "tebessa": "تبسة", "bir el ater": "تبسة", "cheria": "تبسة", "el aouinet": "تبسة", "el kouif": "تبسة", "morsott": "تبسة", "negrine": "تبسة", "ouenza": "تبسة", "bekkaria": "تبسة", "bir dheheb": "تبسة", "boukhadra": "تبسة", "el ma el blan": "تبسة", "el meridj": "تبسة", "gourrigueur": "تبسة", "hammamet": "تبسة", "laid gourzi": "تبسة", "ouled khelifa": "تبسة", "saf saf el ouesra": "تبسة", "stah gueret": "تبسة", "t lidjen": "تبسة",
  // 13 - تلمسان
  "tlemcen": "تلمسان", "maghnia": "تلمسان", "remchi": "تلمسان", "cheouia": "تلمسان", "mansourah": "تلمسان", "hennaya": "تلمسان", "ouled mimoun": "تلمسان", "bensekrane": "تلمسان", "ain fezza": "تلمسان", "ain ghoraba": "تلمسان", "ain kebira": "تلمسان", "ain tellout": "تلمسان", "ain younes": "تلمسان", "amieur": "تلمسان", "azails": "تلمسان", "bab el assa": "تلمسان", "beni bahdel": "تلمسان", "beni boussaid": "تلمسان", "beni mester": "تلمسان", "beni ouarsous": "تلمسان", "beni snous": "تلمسان", "bereziane": "تلمسان", "boudjebaa el bordj": "تلمسان", "bouhlou": "تلمسان", "chettouane belaila": "تلمسان", "dar yaghmoracen": "تلمسان", "djebala": "تلمسان", "el aricha": "تلمسان", "el bouihi": "تلمسان", "el gor": "تلمسان", "fellaoucene": "تلمسان", "ghazaouet": "تلمسان", "hammam boughrara": "تلمسان", "honaine": "تلمسان", "m'sirda fouaga": "تلمسان", "nedroma": "تلمسان", "oued larbaa": "تلمسان", "ouled riyah": "تلمسان", "sabra": "تلمسان", "sebdou": "تلمسان", "sidi abdelli": "تلمسان", "sidi medjahed": "تلمسان", "souahlia": "تلمسان", "souani": "تلمسان", "souk el khemis": "تلمسان", "tianet": "تلمسان", "zenata": "تلمسان",
  // 14 - تيارت
  "tiaret": "تيارت", "frenda": "تيارت", "sougueur": "تيارت", "ksar chellala": "تيارت", "ain deheb": "تيارت", "ain kerbiche": "تيارت", "bougara": "تيارت", "chehaima": "تيارت", "dahmouni": "تيارت", "djebilet rosfa": "تيارت", "guertoufa": "تيارت", "hamadia": "تيارت", "madna": "تيارت", "mahdia": "تيارت", "meghila": "تيارت", "mellakou": "تيارت", "nadorah": "تيارت", "nainia": "تيارت", "oum el adjoul": "تيارت", "rachadia": "تيارت", "rahouia": "تيارت", "rechaiga": "تيارت", "sebt": "تيارت", "sersou": "تيارت", "si abdelghani": "تيارت", "tadjrouna": "تيارت", "tagdempt": "تيارت", "takhemaret": "تيارت", "tidda": "تيارت", "tousnina": "تيارت", "zmalet el emir abdelkader": "تيارت",
  // 15 - تيزي وزو
  "tizi ouzou": "تيزي وزو", "azazga": "تيزي وزو", "draa ben khedda": "تيزي وزو", "larbaa nath irathen": "تيزي وزو", "boghni": "تيزي وزو", "abizar": "تيزي وزو", "agouni gueghrane": "تيزي وزو", "ain el hammam": "تيزي وزو", "akbil": "تيزي وزو", "akbou": "تيزي وزو", "amalou": "تيزي وزو", "ath yenni": "تيزي وزو", "azefoun": "تيزي وزو", "beni aissi": "تيزي وزو", "beni douala": "تيزي وزو", "beni yenni": "تيزي وزو", "beni zmenzer": "تيزي وزو", "bouzeguene": "تيزي وزو", "draa el mizan": "تيزي وزو", "freha": "تيزي وزو", "iboudrarene": "تيزي وزو", "idjeur": "تيزي وزو", "ifigha": "تيزي وزو", "iloula oumalou": "تيزي وزو", "imoula": "تيزي وزو", "m'kira": "تيزي وزو", "makouda": "تيزي وزو", "mekla": "تيزي وزو", "mizrana": "تيزي وزو", "ouacif": "تيزي وزو", "ouadhias": "تيزي وزو", "ouaguenoun": "تيزي وزو", "tigzirt": "تيزي وزو", "tirmitine": "تيزي وزو", "tizi gheniff": "تيزي وزو", "tizi n'tleta": "تيزي وزو", "tizi rached": "تيزي وزو", "yakourene": "تيزي وزو", "yattafene": "تيزي وزو", "zebabdja": "تيزي وزو", "zeghanghane": "تيزي وزو", "zoubgah": "تيزي وزو",
  // 16 - الجزائر
  "algiers": "الجزائر", "alger": "الجزائر", "bab ezzouar": "الجزائر", "birkhadem": "الجزائر", "kouba": "الجزائر", "hydra": "الجزائر", "el biar": "الجزائر", "bab el oued": "الجزائر", "baraki": "الجزائر", "bordj el kiffan": "الجزائر", "dar el beida": "الجزائر", "bir mourad rais": "الجزائر", "hussein dey": "الجزائر", "el harrach": "الجزائر", "bir touta": "الجزائر", "cheraga": "الجزائر", "dely ibrahim": "الجزائر", "draria": "الجزائر", "el achour": "الجزائر", "khraicia": "الجزائر", "saoula": "الجزائر", "tessala el merdja": "الجزائر", "ouled chebel": "الجزائر", "baba hassen": "الجزائر", "douera": "الجزائر", "souidania": "الجزائر", "zeralda": "الجزائر", "mahelma": "الجزائر", "rahmania": "الجزائر", "staoueli": "الجزائر", "ain benian": "الجزائر", "el marsa": "الجزائر", "bordj el bahri": "الجزائر", "el mokrani": "الجزائر", "casbah": "الجزائر", "hamma el annasser": "الجزائر", "sidi m'hamed": "الجزائر", "el madania": "الجزائر", "belouizdad": "الجزائر", "bologhine": "الجزائر", "raisi": "الجزائر", "bologhine ibn ziri": "الجزائر", "el maqqaria": "الجزائر", "djasr kasentina": "الجزائر", "bourouba": "الجزائر", "el magharia": "الجزائر", "bachdjerrah": "الجزائر", "oued smar": "الجزائر", "ben aknoun": "الجزائر", "bouzareah": "الجزائر", "beni messous": "الجزائر",
  // 17 - الجلفة
  "djelfa": "الجلفة", "ain oussera": "الجلفة", "messad": "الجلفة", "hassi bahbah": "الجلفة", "birine": "الجلفة", "ain el ibel": "الجلفة", "ain maabed": "الجلفة", "beni yagoub": "الجلفة", "birine": "الجلفة", "bouira lahdeb": "الجلفة", "chardaia": "الجلفة", "dar chioukh": "الجلفة", "douis": "الجلفة", "el guedid": "الجلفة", "feidh el botma": "الجلفة", "guernini": "الجلفة", "hassi el euch": "الجلفة", "hidoussa": "الجلفة", "maalfa": "الجلفة", "m'liliha": "الجلفة", "moudjbara": "الجلفة", "oum laadham": "الجلفة", "sed rahal": "الجلفة", "sidi baizid": "الجلفة", "sidi laadjel": "الجلفة", "taadmit": "الجلفة", "zaafrane": "الجلفة", "zaccar": "الجلفة",
  // 18 - جيجل
  "jijel": "جيجل", "taher": "جيجل", "el milia": "جيجل", "chellata": "جيجل", "ain tine": "جيجل", "beni belaid": "جيجل", "bordj tahar": "جيجل", "boucif ouled askeur": "جيجل", "boudriaa beni yadjis": "جيجل", "boussif ouled askeur": "جيجل", "chahna": "جيجل", "djemaa beni habibi": "جيجل", "el ancer": "جيجل", "el kennar": "جيجل", "erraguene": "جيجل", "kaous": "جيجل", "khiri oued adjoul": "جيجل", "oudjana": "جيجل", "ouled rabah": "جيجل", "ouled yahia": "جيجل", "selma benziada": "جيجل", "settara": "جيجل", "sidi abdelaziz": "جيجل", "sidi maarouf": "جيجل", "taher": "جيجل", "texenna": "جيجل", "ziama mansouriah": "جيجل",
  // 19 - سطيف
  "setif": "سطيف", "el eulma": "سطيف", "bougaa": "سطيف", "ain oulmene": "سطيف", "ain arnat": "سطيف", "babor": "سطيف", "beni aziz": "سطيف", "bouandas": "سطيف", "hammam guergour": "سطيف", "salah bey": "سطيف", "amoucha": "سطيف", "bababane": "سطيف", "beidha bordj": "سطيف", "beni chebana": "سطيف", "beni fouda": "سطيف", "beni mouhli": "سطيف", "bir el arch": "سطيف", "bir haddada": "سطيف", "boutaleb": "سطيف", "djemila": "سطيف", "guelta zerka": "سطيف", "hammam sokhna": "سطيف", "khelil": "سطيف", "maoklane": "سطيف", "mezloug": "سطيف", "ouled addouane": "سطيف", "ouled siber": "سطيف", "rosfa": "سطيف", "serdj el ghoul": "سطيف", "tachouda": "سطيف", "talaifacene": "سطيف", "taya": "سطيف", "tella": "سطيف", "tizi n'bechar": "سطيف", "guidjel": "سطيف", "hamma": "سطيف", "ain abessa": "سطيف", "ain azel": "سطيف", "ain lahdjar": "سطيف", "ain legraj": "سطيف", "ain sebt": "سطيف", "ain tesra": "سطيف", "ain zouit": "سطيف", "bazer sakhra": "سطيف", "beni oussine": "سطيف", "bousselam": "سطيف", "guenzet": "سطيف", "harbil": "سطيف", "maouklane": "سطيف",
  // 20 - سعيدة
  "saida": "سعيدة", "ain el hadjar": "سعيدة", "ouled brahim": "سعيدة", "youb": "سعيدة", "ain sekhouna": "سعيدة", "doui thabet": "سعيدة", "el hassasna": "سعيدة", "hassasna": "سعيدة", "hounet": "سعيدة", "moulay larbi": "سعيدة", "ouled khaled": "سعيدة", "sidi ahmed": "سعيدة", "sidi boubekeur": "سعيدة", "tircine": "سعيدة",
  // 21 - سكيكدة
  "skikda": "سكيكدة", "azzaba": "سكيكدة", "collO": "سكيكدة", "el harrouch": "سكيكدة", "tamalous": "سكيكدة", "ain cherchar": "سكيكدة", "ain kechra": "سكيكدة", "ain zouit": "سكيكدة", "azzaba": "سكيكدة", "bekkouche lakhdar": "سكيكدة", "ben azzouz": "سكيكدة", "beni bechir": "سكيكدة", "beni oulbane": "سكيكدة", "beni zid": "سكيكدة", "bin el ouiden": "سكيكدة", "bouchetata": "سكيكدة", "cheraia": "سكيكدة", "collO": "سكيكدة", "djendel": "سكيكدة", "el ghedir": "سكيكدة", "el hadaiek": "سكيكدة", "el harrouch": "سكيكدة", "es sebt": "سكيكدة", "filfila": "سكيكدة", "hamadi krouma": "سكيكدة", "kanoua": "سكيكدة", "kerkera": "سكيكدة", "kheneg mayoum": "سكيكدة", "oudjana": "سكيكدة", "ouled attia": "سكيكدة", "ouled heddadj": "سكيكدة", "ramdane djamel": "سكيكدة", "salah bouchaour": "سكيكدة", "sidi mezghiche": "سكيكدة", "tamalous": "سكيكدة", "zitouna": "سكيكدة",
  // 22 - سيدي بلعباس
  "sidi bel abbes": "سيدي بلعباس", "telagh": "سيدي بلعباس", "sidi ali boussidi": "سيدي بلعباس", "ain el berd": "سيدي بلعباس", "ain kada": "سيدي بلعباس", "ain thrid": "سيدي بلعباس", "ain tindamine": "سيدي بلعباس", "amarnas": "سيدي بلعباس", "badredine el mokrani": "سيدي بلعباس", "bedrabine el mokrani": "سيدي بلعباس", "belarbi": "سيدي بلعباس", "ben badis": "سيدي بلعباس", "benachiba chelIA": "سيدي بلعباس", "beni chaib": "سيدي بلعباس", "beni yebka": "سيدي بلعباس", "bir el hammam": "سيدي بلعباس", "boudjebaa el bordj": "سيدي بلعباس", "boukhanefis": "سيدي بلعباس", "chettouane belaila": "سيدي بلعباس", "chentouf": "سيدي بلعباس", "dhaya": "سيدي بلعباس", "el haçaiba": "سيدي بلعباس", "el hassi": "سيدي بلعباس", "hassi dahou": "سيدي بلعباس", "hassi zehana": "سيدي بلعباس", "lamtar": "سيدي بلعباس", "makedra": "سيدي بلعباس", "mcid": "سيدي بلعباس", "merine": "سيدي بلعباس", "mezaourou": "سيدي بلعباس", "mostefa ben brahim": "سيدي بلعباس", "moulay slissen": "سيدي بلعباس", "oued sebaa": "سيدي بلعباس", "oued taourira": "سيدي بلعباس", "ouled ali": "سيدي بلعباس", "ouled berradj": "سيدي بلعباس", "ouled khaddar": "سيدي بلعباس", "ouled slissen": "سيدي بلعباس", "ras el ma": "سيدي بلعباس", "redjem demouche": "سيدي بلعباس", "sefin": "سيدي بلعباس", "sidi ali boussidi": "سيدي بلعباس", "sidi brahim": "سيدي بلعباس", "sidi dahou zairs": "سيدي بلعباس", "sidi hamadouche": "سيدي بلعباس", "sidi khaled": "سيدي بلعباس", "sidi lahou": "سيدي بلعباس", "sidi yacoub": "سيدي بلعباس", "tabia": "سيدي بلعباس", "taoudmout": "سيدي بلعباس", "teghalimet": "سيدي بلعباس", "telagh": "سيدي بلعباس", "tenira": "سيدي بلعباس", "tessala": "سيدي بلعباس", "tilmouni": "سيدي بلعباس", "zerouala": "سيدي بلعباس",
  // 23 - عنابة
  "annaba": "عنابة", "el bouni": "عنابة", "sidi amar": "عنابة", "el hadjar": "عنابة", "berrahal": "عنابة", "chetaibi": "عنابة", "seraidi": "عنابة", "ain berda": "عنابة",
  // 24 - قالمة
  "guelma": "قالمة", "oued zenati": "قالمة", "heliopolis": "قالمة", "bouchegouf": "قالمة", "hammam debagh": "قالمة", "hammam maskhoutine": "قالمة", "ain ben beida": "قالمة", "ain larbi": "قالمة", "ain makhlouf": "قالمة", "ain sandel": "قالمة", "belkheir": "قالمة", "bendjarah": "قالمة", "bou hdjar": "قالمة", "bouati mahmoud": "قالمة", "boumahra ahmed": "قالمة", "dahouara": "قالمة", "djeballah khemissi": "قالمة", "el fedjoudj": "قالمة", "guelaat bou sbaa": "قالمة", "hamman n'baïls": "قالمة", "khezara": "قالمة", "medjez amar": "قالمة", "medjez sfa": "قالمة", "nechmaya": "قالمة", "oued cheham": "قالمة", "oued ferag": "قالمة", "ras el agba": "قالمة", "salaoua announa": "قالمة", "sidi sandel": "قالمة", "tamlouka": "قالمة",
  // 25 - قسنطينة
  "constantine": "قسنطينة", "el khroub": "قسنطينة", "ain smara": "قسنطينة", "didouche mourad": "قسنطينة", "hamma bouziane": "قسنطينة", "ibn ziad": "قسنطينة", "messoud boudjriou": "قسنطينة", "ain abid": "قسنطينة", "beni hamiden": "قسنطينة", "ibn badis": "قسنطينة", "ouled rahmen": "قسنطينة", "ziad": "قسنطينة",
  // 26 - المدية
  "medea": "المدية", "berrouaghia": "المدية", "ksar el boukhari": "المدية", "tablat": "المدية", "ain boucif": "المدية", "ain ouksir": "المدية", "aziz": "المدية", "baata": "المدية", "beni slimane": "المدية", "berrouaghia": "المدية", "bir ben laabed": "المدية", "bouaichoune": "المدية", "bouchrahil": "المدية", "boughezoul": "المدية", "chahbounia": "المدية", "chellalet el adhaoura": "المدية", "cheniguer": "المدية", "derrag": "المدية", "deux bassins": "المدية", "djouab": "المدية", "draa essamar": "المدية", "el azizia": "المدية", "el guelb el kebir": "المدية", "el hamdania": "المدية", "el omaria": "المدية", "ksar el boukhari": "المدية", "m'fatha": "المدية", "medea": "المدية", "medjebar": "المدية", "ouled antar": "المدية", "ouled bouaich": "المدية", "ouled deid": "المدية", "ouled hammou": "المدية", "ouled maaref": "المدية", "oum el djamal": "المدية", "rebaia": "المدية", "sedraia": "المدية", "sidi demed": "المدية", "sidi naamane": "المدية", "sidi zahar": "المدية", "sidi ziane": "المدية", "souagui": "المدية", "tablat": "المدية", "tamesguida": "المدية", "tletat ed douair": "المدية", "zaatarcha": "المدية",
  // 27 - مستغانم
  "mostaganem": "مستغانم", "ain nouissy": "مستغانم", "bouguirat": "مستغانم", "sidi ali": "مستغانم", "achacha": "مستغانم", "ain boudinar": "مستغانم", "ain nouissy": "مستغانم", "ain sidi cherif": "مستغانم", "ain tadles": "مستغانم", "benabdelmalek ramdane": "مستغانم", "bouguirat": "مستغانم", "chaabet el leham": "مستغانم", "el hassaine": "مستغانم", "fornaka": "مستغانم", "hadjadj": "مستغانم", "hassi mameche": "مستغانم", "hassi maameche": "مستغانم", "khair eddine": "مستغانم", "kheir eddine": "مستغانم", "mansourah": "مستغانم", "mazagran": "مستغانم", "mesra": "مستغانم", "mostaganem": "مستغانم", "nador": "مستغانم", "oued el kheir": "مستغانم", "ouled maallah": "مستغانم", "ouled m aallah": "مستغانم", "safsaf": "مستغانم", "sayada": "مستغانم", "sidi ali": "مستغانم", "sidi bellatar": "مستغانم", "sidi khettab": "مستغانم", "sidi lakhdar": "مستغانم", "sirat": "مستغانم", "sofiane": "مستغانم", "sour": "مستغانم", "stidia": "مستغانم", "tazgait": "مستغانم", "touahria": "مستغانم",
  // 28 - المسيلة
  "msila": "المسيلة", "bou saada": "المسيلة", "barika": "المسيلة", "ain el melh": "المسيلة", "ain fares": "المسيلة", "ain khaddra": "المسيلة", "ain rich": "المسيلة", "belaiba": "المسيلة", "beni ilmane": "المسيلة", "beni yagoub": "المسيلة", "berhoum": "المسيلة", "bir foda": "المسيلة", "bou saada": "المسيلة", "bouti sayeh": "المسيلة", "chebilia": "المسيلة", "chelf": "المسيلة", "dehahna": "المسيلة", "djebel messaad": "المسيلة", "el hamel": "المسيلة", "el houamed": "المسيلة", "hammam dhalaa": "المسيلة", "khettouti sed el djir": "المسيلة", "m'cif": "المسيلة", "maadid": "المسيلة", "maarif": "المسيلة", "magra": "المسيلة", "medjedel": "المسيلة", "mensa": "المسيلة", "msila": "المسيلة", "m'tarfa": "المسيلة", "ouled addi guebala": "المسيلة", "ouled derradj": "المسيلة", "ouled madhi": "المسيلة", "ouled mansour": "المسيلة", "ouled sidi brahim": "المسيلة", "sidi aissa": "المسيلة", "sidi hadjeres": "المسيلة", "sidi m'hamed": "المسيلة", "slim": "المسيلة", "tamsa": "المسيلة", "tarmount": "المسيلة", "zarzour": "المسيلة",
  // 29 - معسكر
  "mascara": "معسكر", "sig": "معسكر", "mohammadia": "معسكر", "bouhanifia": "معسكر", "tighennif": "معسكر", "ain fares": "معسكر", "ain fekan": "معسكر", "ain fras": "معسكر", "alaimia": "معسكر", "benian": "معسكر", "bouhanifia": "معسكر", "chorfa": "معسكر", "el bordj": "معسكر", "el ghomri": "معسكر", "el hacaiba": "معسكر", "el keurt": "معسكر", "feradjouah": "معسكر", "froha": "معسكر", "gharrous": "معسكر", "guesmia": "معسكر", "hacine": "معسكر", "mamounia": "معسكر", "mascara": "معسكر", "matha more": "معسكر", "mohammadia": "معسكر", "mokdad": "معسكر", "nesmoth": "معسكر", "othmane": "معسكر", "oued el abtal": "معسكر", "oued taria": "معسكر", "ras ain amirouche": "معسكر", "sedjerara": "معسكر", "sehaouria": "معسكر", "sig": "معسكر", "tighennif": "معسكر", "tizi": "معسكر", "zahana": "معسكر", "zlamta": "معسكر",
  // 30 - ورقلة
  "ouargla": "ورقلة", "hassi messaoud": "ورقلة", "touggourt": "ورقلة", "rouissat": "ورقلة", "ngoussa": "ورقلة", "sidi khouiled": "ورقلة", "ain beida": "ورقلة", "el borma": "ورقلة", "hassi ben abdellah": "ورقلة", "hassi messaoud": "ورقلة", "ngoussa": "ورقلة", "ouargla": "ورقلة", "rouissat": "ورقلة", "sidi khouiled": "ورقلة",
  // 31 - وهران
  "oran": "وهران", "bir el djir": "وهران", "es senia": "وهران", "ain turk": "وهران", "arzew": "وهران", "bethioua": "وهران", "messerine": "وهران", "sidi chami": "وهران", "gdyel": "وهران", "ain el bia": "وهران", "boutlelis": "وهران", "el ancor": "وهران", "el kerma": "وهران", "hassi ben okba": "وهران", "hassi bounif": "وهران", "hassi mefsoukh": "وهران", "marsat el hadjadj": "وهران", "miserghin": "وهران", "oued tlelat": "وهران", "sidi ben yebka": "وهران", "tafraoui": "وهران",
  // 32 - البيض
  "el bayadh": "البيض", "bougtoub": "البيض", "rocher": "البيض", "ain el orak": "البيض", "arhou": "البيض", "bendaoud": "البيض", "boualem": "البيض", "bougtoub": "البيض", "brezina": "البيض", "cheguig": "البيض", "cheheima": "البيض", "el abiodh sidi cheikh": "البيض", "el bayadh": "البيض", "el bnouar": "البيض", "el kheiter": "البيض", "ghassoul": "البيض", "labiodh sidi cheikh": "البيض", "labbé": "البيض", "mehara": "البيض", "rocher": "البيض", "sidi amar": "البيض", "sidi slimane": "البيض", "sidi tifour": "البيض", "stitten": "البيض", "tousmouline": "البيض",
  // 33 - إليزي
  "illizi": "إليزي", "djanet": "إليزي", "in amenas": "إليزي", "bordj omar driss": "إليزي", "debdeb": "إليزي", "djanet": "إليزي", "illizi": "إليزي", "in amenas": "إليزي",
  // 34 - برج بوعريريج
  "bordj bou arreridj": "برج بوعريريج", "ras el oued": "برج بوعريريج", "bordj ghedir": "برج بوعريريج", "ain taghrout": "برج بوعريريج", "bordj zemoura": "برج بوعريريج", "ain taghrout": "برج بوعريريج", "belimour": "برج بوعريريج", "ben daoud": "برج بوعريريج", "bir kasdali": "برج بوعريريج", "bordj bou arreridj": "برج بوعريريج", "bordj ghedir": "برج بوعريريج", "bordj zemoura": "برج بوعريريج", "colla": "برج بوعريريج", "djaafra": "برج بوعريريج", "el achir": "برج بوعريريج", "el annasser": "برج بوعريريج", "el hamadia": "برج بوعريريج", "el main": "برج بوعريريج", "el m'hir": "برج بوعريريج", "ghilassa": "برج بوعريريج", "hasnaoua": "برج بوعريريج", "khelil": "برج بوعريريج", "ksour": "برج بوعريريج", "mansoura": "برج بوعريريج", "medjana": "برج بوعريريج", "m'cid": "برج بوعريريج", "ouled brahim": "برج بوعريريج", "ouled dahmane": "برج بوعريريج", "rabta": "برج بوعريريج", "ras el oued": "برج بوعريريج", "sidi embarek": "برج بوعريريج", "taglait": "برج بوعريريج", "teniet el ansar": "برج بوعريريج", "tesmalt": "برج بوعريريج", "yacine": "برج بوعريريج", "zerouala": "برج بوعريريج",
  // 35 - بومرداس
  "boumerdes": "بومرداس", "bordj menaiel": "بومرداس", "deLLYS": "بومرداس", "khemis el khechna": "بومرداس", "baghlia": "بومرداس", "beni amrane": "بومرداس", "bordj menaiel": "بومرداس", "bouderbala": "بومرداس", "boudouaou": "بومرداس", "boudouaou el bahri": "بومرداس", "boumerdes": "بومرداس", "bouzegza keddara": "بومرداس", "chabet el ameur": "بومرداس", "corso": "بومرداس", "deLLYS": "بومرداس", "draa ben khedda": "بومرداس", "el kharrouba": "بومرداس", "hammedi": "بومرداس", "issaers": "بومرداس", "khemis el khechna": "بومرداس", "larbatache": "بومرداس", "leghata": "بومرداس", "nacer eddine": "بومرداس", "oudjana": "بومرداس", "ouled hedadj": "بومرداس", "ouled moussa": "بومرداس", "reghaia": "بومرداس", "si mustapha": "بومرداس", "souk el had": "بومرداس", "taourga": "بومرداس", "thenia": "بومرداس", "tidjelabine": "بومرداس", "timezrit": "بومرداس", "zemmouri": "بومرداس",
  // 36 - الطارف
  "el tarf": "الطارف", "el kala": "الطارف", "ben m'hidi": "الطارف", "bouhadjar": "الطارف", "ain el assel": "الطارف", "ain kerma": "الطارف", "asfour": "الطارف", "ben m'hidi": "الطارف", "berrihane": "الطارف", "besbes": "الطارف", "bougous": "الطارف", "bouhadjar": "الطارف", "chebaita mokhtar": "الطارف", "cheffia": "الطارف", "chihani": "الطارف", "drean": "الطارف", "echatt": "الطارف", "el aioun": "الطارف", "el kala": "الطارف", "el tarf": "الطارف", "hammam beni salah": "الطارف", "lac des oiseaux": "الطارف", "oued zitoun": "الطارف", "raml souk": "الطارف", "souarekh": "الطارف", "zeraldas": "الطارف",
  // 37 - تندوف
  "tindouf": "تندوف", "ouled said": "تندوف", "tindouf": "تندوف",
  // 38 - تيسمسيلت
  "tissemsilt": "تيسمسيلت", "bordj bou naama": "تيسمسيلت", "theniet el had": "تيسمسيلت", "ain kermes": "تيسمسيلت", "ammari": "تيسمسيلت", "beni chaib": "تيسمسيلت", "beni lahdjel": "تيسمسيلت", "bordj bou naama": "تيسمسيلت", "bordj el emir abdelkader": "تيسمسيلت", "boucaid": "تيسمسيلت", "khemisti": "تيسمسيلت", "lardjem": "تيسمسيلت", "lardjem": "تيسمسيلت", "lazharia": "تيسمسيلت", "maacem": "تيسمسيلت", "melaab": "تيسمسيلت", "ouled bessem": "تيسمسيلت", "sidi abed": "تيسمسيلت", "sidi lantri": "تيسمسيلت", "sidi slimane": "تيسمسيلت", "tamezguida": "تيسمسيلت", "theniet el had": "تيسمسيلت", "thnieT el had": "تيسمسيلت", "tissemsilt": "تيسمسيلت", "youssoufia": "تيسمسيلت",
  // 39 - الوادي
  "el oued": "الوادي", "oued souf": "الوادي", "guemar": "الوادي", "debba": "الوادي", "hassani abdelkrim": "الوادي", "ain amiche": "الوادي", "bayadha": "الوادي", "debba": "الوادي", "douar el ma": "الوادي", "el m'ghair": "الوادي", "el oued": "الوادي", "guemar": "الوادي", "hamraia": "الوادي", "hassan djellaba": "الوادي", "hassani abdelkrim": "الوادي", "kouinine": "الوادي", "magrane": "الوادي", "mih ouansa": "الوادي", "nakhla": "الوادي", "oued el alenda": "الوادي", "ouermel": "الوادي", "reguiba": "الوادي", "robbah": "الوادي", "sidi aoun": "الوادي", "taghzout": "الوادي", "taleb larbi": "الوادي", "trifaoui": "الوادي",
  // 40 - خنشلة
  "khenchela": "خنشلة", "ain touila": "خنشلة", "ksar el boukhari": "خنشلة", "babar": "خنشلة", "baghai": "خنشلة", "bouhmama": "خنشلة", "chechar": "خنشلة", "cherchar": "خنشلة", "djellal": "خنشلة", "el hamma": "خنشلة", "el mahmal": "خنشلة", "el oueldja": "خنشلة", "ensigha": "خنشلة", "khenchela": "خنشلة", "khirane": "خنشلة", "ksar el boukhari": "خنشلة", "m'sara": "خنشلة", "ouled rechache": "خنشلة", "remila": "خنشلة", "taouzianat": "خنشلة", "yabous": "خنشلة",
  // 41 - سوق أهراس
  "souk ahras": "سوق أهراس", "sedrata": "سوق أهراس", "taoura": "سوق أهراس", "ain soltane": "سوق أهراس", "ain zana": "سوق أهراس", "bir bouhouche": "سوق أهراس", "drea": "سوق أهراس", "haddada": "سوق أهراس", "hanencha": "سوق أهراس", "khedara": "سوق أهراس", "khemissa": "سوق أهراس", "m'daourouche": "سوق أهراس", "merahna": "سوق أهراس", "oued kebrit": "سوق أهراس", "ouillen": "سوق أهراس", "oum el adham": "سوق أهراس", "raghouba": "سوق أهراس", "safel el ouiden": "سوق أهراس", "sedrata": "سوق أهراس", "sidi fredj": "سوق أهراس", "souk ahras": "سوق أهراس", "taoura": "سوق أهراس", "terrag": "سوق أهراس", "zaarouria": "سوق أهراس",
  // 42 - تيبازة
  "tipaza": "تيبازة", "cherchell": "تيبازة", "koléa": "تيبازة", "hadjout": "تيبازة", "fouka": "تيبازة", "ahmer el ain": "تيبازة", "ain tagourait": "تيبازة", "attatba": "تيبازة", "beni mileuk": "تيبازة", "bou haroun": "تيبازة", "bou ismail": "تيبازة", "chaiba": "تيبازة", "cherchell": "تيبازة", "damous": "تيبازة", "djebel abiod": "تيبازة", "douaouda": "تيبازة", "fouka": "تيبازة", "gouraya": "تيبازة", "hadjout": "تيبازة", "khemisti": "تيبازة", "koléa": "تيبازة", "larhat": "تيبازة", "menaceur": "تيبازة", "merad": "تيبازة", "messelmoun": "تيبازة", "nador": "تيبازة", "sidi amar": "تيبازة", "sidi ghiles": "تيبازة", "sidi rached": "تيبازة", "sidi semiane": "تيبازة", "tipaza": "تيبازة",
  // 43 - ميلة
  "mila": "ميلة", "chelghoum laid": "ميلة", "ferdjioua": "ميلة", "grarem gouga": "ميلة", "oued endja": "ميلة", "ain beida harriche": "ميلة", "ain mellouk": "ميلة", "ain tine": "ميلة", "ammal": "ميلة", "benyahia abderrahmane": "ميلة", "bouhatem": "ميلة", "chigara": "ميلة", "derradji bousselah": "ميلة", "el ayadi barbes": "ميلة", "el mechira": "ميلة", "ferdjioua": "ميلة", "grarem gouga": "ميلة", "hamala": "ميلة", "mila": "ميلة", "minar zarza": "ميلة", "oued athmania": "ميلة", "oued endja": "ميلة", "rouached": "ميلة", "sidi khelifa": "ميلة", "sidi merouane": "ميلة", "tassadane haddada": "ميلة", "tassadjene": "ميلة", "teleghma": "ميلة", "terrai bainen": "ميلة", "tiberguent": "ميلة", "yacine": "ميلة", "zeghaia": "ميلة",
  // 44 - عين الدفلى
  "ain defla": "عين الدفلى", "khemis miliana": "عين الدفلى", "miliana": "عين الدفلى", "el attaf": "عين الدفلى", "bordj emir khaled": "عين الدفلى", "ain benian": "عين الدفلى", "ain bouchkif": "عين الدفلى", "ain defla": "عين الدفلى", "ain lechiakh": "عين الدفلى", "ain sultan": "عين الدفلى", "ain taghrout": "عين الدفلى", "ain torki": "عين الدفلى", "bathia": "عين الدفلى", "belaas": "عين الدفلى", "ben allal": "عين الدفلى", "bir ould khelifa": "عين الدفلى", "bordj emir khaled": "عين الدفلى", "boumedfaa": "عين الدفلى", "djelida": "عين الدفلى", "djemaa ouled cheikh": "عين الدفلى", "djendel": "عين الدفلى", "el abadia": "عين الدفلى", "el attaf": "عين الدفلى", "el amra": "عين الدفلى", "el hassania": "عين الدفلى", "el main": "عين الدفلى", "el ouadj": "عين الدفلى", "hammam righa": "عين الدفلى", "hoceinia": "عين الدفلى", "khemis miliana": "عين الدفلى", "mekhatria": "عين الدفلى", "miliana": "عين الدفلى", "oued chorfa": "عين الدفلى", "oued dj": "عين الدفلى", "oued el djemaa": "عين الدفلى", "rouina": "عين الدفلى", "sidi lakhdar": "عين الدفلى", "tachta zogagha": "عين الدفلى", "tiberkanine": "عين الدفلى", "zeddine": "عين الدفلى",
  // 45 - النعامة
  "naama": "النعامة", "mecheria": "النعامة", "ain sefra": "النعامة", "sFissifa": "النعامة", "ain ben khelil": "النعامة", "ain sefra": "النعامة", "asla": "النعامة", "djeniene bourezg": "النعامة", "el biod": "النعامة", "kasdir": "النعامة", "makman ben amer": "النعامة", "mecheria": "النعامة", "moghrar": "النعامة", "naama": "النعامة", "sFissifa": "النعامة", "tiout": "النعامة",
  // 46 - عين تموشنت
  "ain temouchent": "عين تموشنت", "beni saf": "عين تموشنت", "el malah": "عين تموشنت", "hammam bouhadjar": "عين تموشنت", "ain el arbaa": "عين تموشنت", "ain kihal": "عين تموشنت", "ain temouchent": "عين تموشنت", "ain tolba": "عين تموشنت", "beni saf": "عين تموشنت", "bouzedjar": "عين تموشنت", "chaabat el leham": "عين تموشنت", "chentouf": "عين تموشنت", "el amria": "عين تموشنت", "el maleh": "عين تموشنت", "el messaid": "عين تموشنت", "emir abdelkader": "عين تموشنت", "hammam bouhadjar": "عين تموشنت", "hassi el ghella": "عين تموشنت", "oued berkech": "عين تموشنت", "oued sabbagh": "عين تموشنت", "ouled boujemaa": "عين تموشنت", "ouled kihal": "عين تموشنت", "sidi ben adda": "عين تموشنت", "sidi boumediene": "عين تموشنت", "sidi safi": "عين تموشنت", "tamzoura": "عين تموشنت", "terga": "عين تموشنت", "tsaDet": "عين تموشنت",
  // 47 - غرداية
  "ghardaia": "غرداية", "metlili": "غرداية", "berriane": "غرداية", "el atteuf": "غرداية", "bounoura": "غرداية", "daya ben dahoua": "غرداية", "berriane": "غرداية", "bounoura": "غرداية", "daya ben dahoua": "غرداية", "djaMaa": "غرداية", "el atteuf": "غرداية", "el guerara": "غرداية", "ghardaia": "غرداية", "mansoura": "غرداية", "metlili": "غرداية", "sebseb": "غرداية", "zalfana": "غرداية",
  // 48 - غليزان
  "relizane": "غليزان", "Oued rhiou": "غليزان", "mazouna": "غليزان", "zemmoura": "غليزان", "ain tarek": "غليزان", "ammi moussa": "غليزان", "bendaoud": "غليزان", "beni dergoun": "غليزان", "beni zentis": "غليزان", "dar ben abdellah": "غليزان", "djidiouia": "غليزان", "el guettar": "غليزان", "el h'madna": "غليزان", "el matmar": "غليزان", "el ouldja": "غليزان", "had echkalla": "غليزان", "hamri": "غليزان", "kalaa": "غليزان", "lahlef": "غليزان", "mazouna": "غليزان", "mediouna": "غليزان", "merdja sidi abed": "غليزان", "Oued el djemaa": "غليزان", "Oued essalem": "غليزان", "Oued rhiou": "غليزان", "Ouled aiche": "غليزان", "Ouled sia ben ali": "غليزان", "ramka": "غليزان", "relizane": "غليزان", "sidi khettab": "غليزان", "sidi lahzari": "غليزان", "sidi m'hamed benali": "غليزان", "sidi m'hamed ben ali": "غليزان", "souk el had": "غليزان", "yellel": "غليزان", "zemmoura": "غليزان",
  // 49 - تيميمون
  "timimoun": "تيميمون", "charouine": "تيميمون", "reggane": "تيميمون", "aougrout": "تيميمون", "deldoul": "تيميمون", "metarfa": "تيميمون", "ouled said": "تيميمون", "talmine": "تيميمون", "tinerkouk": "تيميمون", "timimoun": "تيميمون",
  // 50 - برج باجي مختار
  "bordj badji mokhtar": "برج باجي مختار", "timiaouine": "برج باجي مختار", "bordj badji mokhtar": "برج باجي مختار",
  // 51 - أولاد جلال
  "ouled djellal": "أولاد جلال", "sidi khaled": "أولاد جلال", "doucen": "أولاد جلال", "chaiba": "أولاد جلال", "ras el miaad": "أولاد جلال", "ouled djellal": "أولاد جلال",
  // 52 - بني عباس
  "beni abbes": "بني عباس", "igline": "بني عباس", "tabalbala": "بني عباس", "tabelbala": "بني عباس", "tamtert": "بني عباس", "beni abbes": "بني عباس",
  // 53 - عين صالح
  "in salah": "عين صالح", "foggaret ezzoua": "عين صالح", "in ghar": "عين صالح", "in salah": "عين صالح",
  // 54 - عين قزام
  "in guezzam": "عين قزام", "tin zaouatine": "عين قزام", "in guezzam": "عين قزام",
  // 55 - تقرت
  "touggourt": "تقرت", "témacine": "تقرت", "temacine": "تقرت", "zaouia el abidia": "تقرت", "blidet amor": "تقرت", "el hadjira": "تقرت", "el hadjira": "تقرت", "megarine": "تقرت", "neggrine": "تقرت", "taibet": "تقرت", "touggourt": "تقرت",
  // 56 - جانت
  "djanet": "جانت", "bordj el haouas": "جانت", "djanet": "جانت",
  // 57 - المغير
  "el m'ghair": "المغير", "djamaa": "المغير", "oum el thiour": "المغير", "sidi amrane": "المغير", "still": "المغير", "tendla": "المغير", "el m'ghair": "المغير",
  // 58 - المنيعة
  "el meniaa": "المنيعة", "hassi gara": "المنيعة", "hassi fehal": "المنيعة", "mansoura": "المنيعة", "el meniaa": "المنيعة"
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'ERROR', message: 'Method not allowed' });
  }

  try {
    const { secret_code } = req.body || {};

    if (!secret_code || typeof secret_code !== 'string' || secret_code.trim() === '') {
      return res.status(400).json({ status: 'ERROR', message: 'Code secret manquant' });
    }

    const cleanCode = secret_code.trim().toUpperCase();

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ status: 'ERROR', message: 'Configuration manquante' });
    }

    // 🔒 Rate Limiting
    const ip = getClientIp(req) || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    try {
      const rlRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            p_key: 'verify:' + ip,
            p_limit: 20,
            p_window_seconds: 60
          })
        }
      );

      if (rlRes.ok) {
        const allowed = await rlRes.json();
        if (allowed === false) {
          return res.status(429).json({
            status: 'ERROR',
            message: 'Trop de tentatives. Réessayez dans une minute.'
          });
        }
      }
    } catch (rlErr) {
      // لا نُفشل الطلب إذا فشل فحص rate limit — نكمل بحذر
      console.warn('Rate limit check failed:', rlErr);
    }

    // Calculer le hash SHA-256
    const codeHash = hashCode(cleanCode);

    // Appeler verify_code_v3 (nouvelle version sécurisée)
const rpcResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/rpc/verify_code_v3`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          p_code_hash: codeHash,
          p_plaintext_code: cleanCode
        })
      }
    );

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text();
      console.error('Supabase RPC error:', errText);
      return res.status(500).json({
        status: 'ERROR',
        message: 'Erreur serveur'
      });
    }

    const data = await rpcResponse.json();

    // ✅ استخراج المدينة وتحويلها إلى ولاية
    let rawCity = req.headers['x-vercel-ip-city'] || null;
    let finalCity = rawCity;
    
    if (rawCity) {
      rawCity = decodeURIComponent(rawCity).trim().toLowerCase();
      
      // البحث في الخريطة
      if (CITY_TO_WILAYA[rawCity]) {
        finalCity = CITY_TO_WILAYA[rawCity];
      }
    }
    
    const country = req.headers['x-vercel-ip-country'] || null;

    // Journaliser la tentative (fire-and-forget)
    const logRow = {
      secret_code: cleanCode,
      result: data.status || 'UNKNOWN',
      brand: data.product?.brand || null,
      product_name: data.product?.product_name || null,
      lot: data.product?.lot || null,
      ip: ip,
      city: finalCity, // ✅ إضافة المدينة
      country: country,
      user_agent: userAgent
    };

    // ✅ تسجيل التحقق مع انتظار النتيجة لضمان الحفظ
    try {
      const logRes = await fetch(`${SUPABASE_URL}/rest/v1/qr_verifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(logRow)
      });
      
      if (!logRes.ok) {
        const errText = await logRes.text();
        console.error('Log insert error:', errText);
      } else {
        console.log('✅ Verification logged successfully');
      }
    } catch (logErr) {
      console.error('Log fetch error:', logErr);
    }
    return res.status(200).json(data);

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Erreur inattendue'
    });
  }
}
