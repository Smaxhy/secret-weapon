// Word book: category -> "english|japanese|romaji" lines
window.WORDS = {
  "🍣 Food": `rice|ご飯|gohan
bread|パン|pan
meat|肉|niku
chicken|鶏肉|toriniku
pork|豚肉|butaniku
beef|牛肉|gyuuniku
fish|魚|sakana
raw fish|刺身|sashimi
egg|卵|tamago
noodles|麺|men
ramen|ラーメン|raamen
udon|うどん|udon
soba|そば|soba
sushi|寿司|sushi
curry|カレー|karee
fried chicken|唐揚げ|karaage
dumplings|餃子|gyouza
skewers|焼き鳥|yakitori
pancake|お好み焼き|okonomiyaki
octopus balls|たこ焼き|takoyaki
beef bowl|牛丼|gyuudon
rice ball|おにぎり|onigiri
soup|スープ|suupu
miso soup|味噌汁|misoshiru
salad|サラダ|sarada
vegetables|野菜|yasai
fruit|果物|kudamono
apple|りんご|ringo
strawberry|いちご|ichigo
banana|バナナ|banana
cheese|チーズ|chiizu
tofu|豆腐|toufu
shrimp|エビ|ebi
crab|カニ|kani
squid|イカ|ika
salmon|サーモン|saamon
tuna|マグロ|maguro
eel|うなぎ|unagi
seaweed|海苔|nori
soy sauce|醤油|shouyu
salt|塩|shio
sugar|砂糖|satou
pepper|胡椒|koshou
spicy|辛い|karai
sweet|甘い|amai
salty|しょっぱい|shoppai
sour|酸っぱい|suppai
bitter|苦い|nigai
delicious|美味しい|oishii
tasty|うまい|umai
gross|まずい|mazui
dessert|デザート|dezaato
ice cream|アイス|aisu
cake|ケーキ|keeki
snack|おやつ|oyatsu
breakfast|朝ご飯|asagohan
lunch|昼ご飯|hirugohan
dinner|晩ご飯|bangohan
chopsticks|箸|hashi
spoon|スプーン|supuun
fork|フォーク|fooku
plate|皿|sara
menu|メニュー|menyuu
bill|お会計|okaikei
restaurant|レストラン|resutoran
izakaya|居酒屋|izakaya
allergy|アレルギー|arerugii`,
  "🥤 Drinks": `water|水|mizu
ice water|お冷|ohiya
tea|お茶|ocha
green tea|緑茶|ryokucha
coffee|コーヒー|koohii
milk|牛乳|gyuunyuu
juice|ジュース|juusu
beer|ビール|biiru
draft beer|生ビール|namabiiru
sake|日本酒|nihonshu
highball|ハイボール|haibooru
wine|ワイン|wain
cola|コーラ|koora
ice|氷|koori
hot|ホット|hotto
iced|アイス|aisu
alcohol|お酒|osake
drunk|酔った|yotta`,
  "👕 Clothes": `clothes|服|fuku
shirt|シャツ|shatsu
t-shirt|Tシャツ|tii shatsu
hoodie|パーカー|paakaa
sweater|セーター|seetaa
jacket|ジャケット|jaketto
coat|コート|kooto
pants|ズボン|zubon
jeans|ジーンズ|jiinzu
shorts|短パン|tanpan
skirt|スカート|sukaato
dress|ワンピース|wanpiisu
shoes|靴|kutsu
sneakers|スニーカー|suniikaa
socks|靴下|kutsushita
underwear|下着|shitagi
hat|帽子|boushi
cap|キャップ|kyappu
bag|カバン|kaban
backpack|リュック|ryukku
wallet|財布|saifu
glasses|メガネ|megane
sunglasses|サングラス|sangurasu
watch|時計|tokei
belt|ベルト|beruto
size|サイズ|saizu
fitting room|試着室|shichakushitsu
tight|キツい|kitsui
loose|ゆるい|yurui
long|長い|nagai
short|短い|mijikai
cheap|安い|yasui
expensive|高い|takai
sale|セール|seeru
tax free|免税|menzei
receipt|レシート|reshiito`,
  "🎨 Colors": `red|赤|aka
blue|青|ao
light blue|水色|mizuiro
navy|紺|kon
green|緑|midori
yellow|黄色|kiiro
orange|オレンジ|orenji
pink|ピンク|pinku
purple|紫|murasaki
black|黒|kuro
white|白|shiro
gray|グレー|guree
brown|茶色|chairo
beige|ベージュ|beeju
gold|金色|kiniro
silver|銀色|giniro
color|色|iro
dark|濃い|koi
light|薄い|usui`,
  "🚆 Travel": `station|駅|eki
train|電車|densha
bullet train|新幹線|shinkansen
subway|地下鉄|chikatetsu
bus|バス|basu
taxi|タクシー|takushii
airport|空港|kuukou
ticket|切符|kippu
platform|ホーム|hoomu
exit|出口|deguchi
entrance|入口|iriguchi
transfer|乗り換え|norikae
hotel|ホテル|hoteru
room|部屋|heya
key|鍵|kagi
reservation|予約|yoyaku
map|地図|chizu
toilet|トイレ|toire
convenience store|コンビニ|konbini
shop|店|mise
temple|お寺|otera
shrine|神社|jinja
park|公園|kouen
beach|ビーチ|biichi
mountain|山|yama
street|通り|toori
left|左|hidari
right|右|migi
straight|まっすぐ|massugu
near|近い|chikai
far|遠い|tooi
here|ここ|koko
there|そこ|soko
over there|あそこ|asoko
north|北|kita
south|南|minami
east|東|higashi
west|西|nishi
passport|パスポート|pasupooto
luggage|荷物|nimotsu
phone|スマホ|sumaho
charger|充電器|juudenki
wifi|Wi-Fi|waifai`,
  "🙋 People": `i|俺 / 私|ore / watashi
you|君 / あなた|kimi / anata
he|彼|kare
she|彼女|kanojo
we|俺たち|oretachi
they|あいつら|aitsura
friend|友達|tomodachi
boyfriend|彼氏|kareshi
girlfriend|彼女|kanojo
guy|男|otoko
girl|女の子|onna no ko
person|人|hito
everyone|みんな|minna
family|家族|kazoku
mom|お母さん|okaasan
dad|お父さん|otousan
brother|兄弟|kyoudai
sister|姉妹|shimai
staff|店員|ten'in
foreigner|外国人|gaikokujin
doctor|医者|isha
police|警察|keisatsu`,
  "⚡ Verbs": `go|行く|iku
come|来る|kuru
eat|食べる|taberu
drink|飲む|nomu
buy|買う|kau
sell|売る|uru
see|見る|miru
look|見る|miru
watch|見る|miru
hear|聞く|kiku
listen|聞く|kiku
ask|聞く|kiku
say|言う|iu
speak|話す|hanasu
talk|話す|hanasu
read|読む|yomu
write|書く|kaku
know|知ってる|shitteru
understand|わかる|wakaru
think|思う|omou
want|欲しい|hoshii
like|好き|suki
love|大好き|daisuki
hate|嫌い|kirai
need|必要|hitsuyou
have|持ってる|motteru
make|作る|tsukuru
do|する|suru
play|遊ぶ|asobu
sleep|寝る|neru
wake up|起きる|okiru
walk|歩く|aruku
run|走る|hashiru
wait|待つ|matsu
help|助ける|tasukeru
pay|払う|harau
open|開ける|akeru
close|閉める|shimeru
take|取る|toru
give|あげる|ageru
use|使う|tsukau
try|試す|tamesu
meet|会う|au
return|帰る|kaeru
leave|出る|deru
enter|入る|hairu
stop|止まる|tomaru
find|見つける|mitsukeru
lose|なくす|nakusu
forget|忘れる|wasureru
remember|覚える|oboeru
learn|学ぶ|manabu
work|働く|hataraku
rest|休む|yasumu
dance|踊る|odoru
sing|歌う|utau
laugh|笑う|warau
cry|泣く|naku
call|電話する|denwa suru
choose|選ぶ|erabu`,
  "✨ Describe": `good|いい|ii
bad|悪い|warui
big|大きい|ookii
small|小さい|chiisai
hot|暑い|atsui
cold|寒い|samui
new|新しい|atarashii
old|古い|furui
fast|速い|hayai
slow|遅い|osoi
easy|簡単|kantan
difficult|難しい|muzukashii
fun|楽しい|tanoshii
boring|つまらない|tsumaranai
cute|かわいい|kawaii
cool|かっこいい|kakkoii
beautiful|きれい|kirei
clean|きれい|kirei
dirty|汚い|kitanai
busy|忙しい|isogashii
free|暇|hima
tired|疲れた|tsukareta
hungry|お腹すいた|onaka suita
full|お腹いっぱい|onaka ippai
sleepy|眠い|nemui
happy|嬉しい|ureshii
sad|悲しい|kanashii
scary|怖い|kowai
funny|おもしろい|omoshiroi
crazy|やばい|yabai
amazing|すごい|sugoi
okay|大丈夫|daijoubu
right|正しい|tadashii
wrong|違う|chigau
same|同じ|onaji
different|違う|chigau
many|多い|ooi
few|少ない|sukunai
very|めっちゃ|meccha
really|マジで|maji de
a little|ちょっと|chotto
more|もっと|motto
too much|多すぎ|oosugi`,
  "🕐 Time & Numbers": `now|今|ima
today|今日|kyou
tomorrow|明日|ashita
yesterday|昨日|kinou
morning|朝|asa
afternoon|昼|hiru
evening|夕方|yuugata
night|夜|yoru
week|週|shuu
month|月|tsuki
year|年|toshi
later|後で|atode
soon|すぐ|sugu
always|いつも|itsumo
sometimes|時々|tokidoki
never|絶対ない|zettai nai
hour|時間|jikan
minute|分|fun
one|一|ichi
two|二|ni
three|三|san
four|四|yon
five|五|go
six|六|roku
seven|七|nana
eight|八|hachi
nine|九|kyuu
ten|十|juu
hundred|百|hyaku
thousand|千|sen
ten thousand|万|man
yen|円|en
money|お金|okane
cash|現金|genkin
card|カード|kaado`,
  "❓ Question words": `what|何|nani
where|どこ|doko
when|いつ|itsu
who|誰|dare
why|なんで|nande
how|どう|dou
how much|いくら|ikura
how many|いくつ|ikutsu
which|どれ|dore
this|これ|kore
that|それ|sore
yes|うん|un
no|ううん|uun
please|お願い|onegai
thanks|ありがと|arigato
sorry|ごめん|gomen
and|と|to
or|か|ka
but|でも|demo
with|一緒に|issho ni
without|なし|nashi
not|ない|nai`,
};
