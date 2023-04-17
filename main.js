//毎日9時に実行
function dailyPost(){
  const menuTable = getMenuTable(0); //0だと今日　1だと明日　-1だと昨日のメニューを取得できる

  if(menuTable.status == "ok"){
    console.log(menuTable.text);
    // postLine(menuTable.text);     //　LINEへの毎朝投稿は廃止しました
    postDiscord(menuTable.text,"TZU学食ぞぞこbot",MANKEN_WEBHOOK_URL);
    postDiscord(menuTable.text,"TZU学食bot",GAKUSHOKU_WEBHOOK_URL);
    postSheet(menuTable.menuArray.date , menuTable.menuArray.title , menuTable.menuArray.price);
    postDiscord(PropertiesService.getScriptProperties().getProperty("TodaysMenuAI"),"TZU高級学食bot",GAKUSHOKU_GPT_WEBHOOK_URL);
  } else {
    console.log(menuTable.status);
  }
}

//3日分のメニューを取得(15時ごろに実行)
function set3daysMenuTable() {
  const yesterdayMenu = getMenuTable(1)
  const menu = yesterdayMenu.text +"\n\n"+ getMenuTable(2).text +"\n\n"+ getMenuTable(3).text;
  PropertiesService.getScriptProperties().setProperty("TodaysMenuTable",menu); 
      //console.log(PropertiesService.getScriptProperties().getProperty("TodaysMenuTable"))

  if(yesterdayMenu.status == 'ok'){
    gptCall(getMenuTable(1).text);
    console.log(PropertiesService.getScriptProperties().getProperty("TodaysMenuAI"));
  } else{
    PropertiesService.getScriptProperties().setProperty("TodaysMenuAI","データなし"); 
  }
}

//メニュー表取得
function getMenuTable(days = 0) {

  // 対象ページのURL
  var getUrl = getMenuURLByRelativeDate(days);
  // htmlをテキスト情報にして抽出
  var html = UrlFetchApp.fetch(getUrl[0]).getContentText('UTF-8');

  // 文字列を抽出
  var h3 = Parser.data(html).from('<h3>').to('</h3>').iterate();
  var menu_type = Parser.data(html).from('height="60" alt="').to(' class="alignleft"').iterate();
  var menu_title = Parser.data(html).from('class="alignleft" />\n                ').to('<br />').iterate();
  var menu_price = Parser.data(html).from('<strong>').to('円</strong>').iterate();


  //投稿文作成
  //  str = h3 + '\n\n'; 
  str = "";
  for(var i =0 ; i < menu_type.length; i++ ){
    if(menu_price[i]>100){
      str = str + '⭐️ ' + menu_title[i].trim()+ "\t¥" + menu_price[i] +'\n' ;
    }else{
      ;
    }
  }
  str = str + '　　　他'

  //メニュー作成
  if(menu_type.length > 1){
    return {
      text : `[${getUrl[1]}のメニュー]\n${str}` ,
      status : "ok",
      menuArray : {
        date : getUrl[2] ,
        title : menu_title ,
        price : menu_price
      }
    } ;
  } else{
    return {
      text : `[${getUrl[1]}のメニュー]\nデータ無し` ,
      status : "nothing" ,
      menuArray : {}
    } ;
  }
}

//メニューURL生成
function getMenuURLByRelativeDate(days) {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const year = targetDate.getFullYear();
  const month = ('0' + (targetDate.getMonth() + 1)).slice(-2);
  const day = ('0' + targetDate.getDate()).slice(-2);
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][targetDate.getDay()];
  const url = `https://www.zokei.ac.jp/university/cafeteria/cafemenu/?Y=${year}&M=${month}&D=${day}&W=${dayOfWeek}`;
  return [url, `${year}/${month}/${day}(${dayOfWeek})`,`${year}-${month}-${day}`];
}

//LINEに投稿する
function postLine(str) {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_TOKEN");
  
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    payload: JSON.stringify({
      messages: [
        {
            type: 'text',
            text: str
        }
      ]
    }),
  });
}



//Discordに投稿
function postDiscord(str,username,WEBHOOK_URL) {
  const payload = {username: username , content: str , };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  });
}

//スプレッドシート記録
function postSheet(date,menu_title,menu_price) {
  var id = SPREADSHEETS_ID;
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getActiveSheet();

  for(var i =0 ; i < menu_title.length ; i++ ){
    sheet.appendRow([date,menu_title[i].trim(), menu_price[i]]);
  }
}

//GPT呼び出し
function gptCall(menuTexts) {
  var request = "高級レストランのスタッフとして振る舞って、次のメニューの「料理と価格」を宣伝する文章を考えてください。改行を入れて読みやすくしてください。"
  var request= request +'\n'+ menuTexts;
  console.log(request);

  var responce = requestChatgpt(request);

  PropertiesService.getScriptProperties().setProperty("TodaysMenuAI",responce); 
}

//GPTのAPI
function requestChatgpt(sendMessage) {
  //スクリプトプロパティに設定したOpenAIのAPIキーを取得
  const apiKey = ScriptProperties.getProperty('CHATGPT_APIKEY');
  //ChatGPTのAPIのエンドポイントを設定
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  //ChatGPTに投げるメッセージを定義(ユーザーロールの投稿文のみ)
    const messages = [{'role': 'user', 'content': sendMessage }];
  //OpenAIのAPIリクエストに必要なヘッダー情報を設定
  const headers = {
    'Authorization':'Bearer '+ apiKey,
    'Content-type': 'application/json',
    'X-Slack-No-Retry': 1
  };
  //ChatGPTモデルやトークン上限、プロンプトをオプションに設定
  const options = {
    'muteHttpExceptions' : true,
    'headers': headers, 
    'method': 'POST',
    'payload': JSON.stringify({
      'model': 'gpt-3.5-turbo',
      'max_tokens' : 1024,
      'temperature' : 0.7,
      'messages': messages})
  };
  //OpenAIのChatGPTにAPIリクエストを送り、結果を変数に格納
  const response = JSON.parse(UrlFetchApp.fetch(apiUrl, options).getContentText());
  //ChatGPTのAPIレスポンスをログ出力
  console.log(response.choices[0].message.content);

  return response.choices[0].message.content;
}


//LINEreplyAPIで3日分のメニューを返信
function doPost(e) {
  //スクリプトプロパティから前回の呼び出し時間を取得
  const lastCallTime = PropertiesService.getScriptProperties().getProperty("lastCallTime");

  //前回の呼び出し時間がある場合、現在の時間と比較し、一定時間内に呼び出されているかをチェック
  if(lastCallTime){
    const currentTime =new Date().getTime();
    const timeDiff = currentTime - lastCallTime;
    if(timeDiff < 3000){ //10秒以内に呼び出されていた場合
      return;
    } else {
      //現在の時間をスクリプトプロパティに保存
      PropertiesService.getScriptProperties().setProperty("lastCallTime",new Date().getTime());

      //LINE Messaging APIのチャネルアクセストークンを設定
      const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_TOKEN");

      // Webhookで取得したJSONデータをオブジェクト化し、取得
      const eventData = JSON.parse(e.postData.contents).events[0];
      //取得したデータから、応答用のトークンを取得
      const replyToken = eventData.replyToken;

      //取得したデータから、ユーザーが投稿したメッセージを取得
      const userMessage = eventData.message.text;

      if(eventData.message.text == "MENU"){


        // 応答メッセージ用のAPI URLを定義
        const url = 'https://api.line.me/v2/bot/message/reply';

        const messages = [];
        messages.push({
          'type': 'text',
          'text': PropertiesService.getScriptProperties().getProperty("TodaysMenuTable")
          })

        //APIリクエスト時にセットするペイロード値を設定する
        const payload = {
          'replyToken': replyToken,
          'messages': messages
        };

        //HTTPSのPOST時のオプションパラメータを設定する
        const options = {
          'payload': JSON.stringify(payload),
          'myamethod': 'POST',
          'headers': { "Authorization": "Bearer " + token },
          'contentType': 'application/json'
        };

        //LINE Messaging APIにリクエストし、ユーザーからの投稿に返答する
        UrlFetchApp.fetch(url, options);
          postDiscord(eventData.message.text + timeDiff/1000/60 + "分","ログ",GAKUSHOKU_LOG_WEBHOOK_URL); //Discordにログを残す

      }else if (eventData.message.text == "AI_MENU"){

        // 応答メッセージ用のAPI URLを定義
        const url = 'https://api.line.me/v2/bot/message/reply';

        const messages = [];
        messages.push({
          'type': 'text',
          'text': PropertiesService.getScriptProperties().getProperty("TodaysMenuAI")
          })

        //APIリクエスト時にセットするペイロード値を設定する
        const payload = {
          'replyToken': replyToken,
          'messages': messages
        };

        //HTTPSのPOST時のオプションパラメータを設定する
        const options = {
          'payload': JSON.stringify(payload),
          'myamethod': 'POST',
          'headers': { "Authorization": "Bearer " + token },
          'contentType': 'application/json'
        };

        //LINE Messaging APIにリクエストし、ユーザーからの投稿に返答する
        UrlFetchApp.fetch(url, options);
          postDiscord(eventData.message.text + timeDiff/1000/60 + "分","ログ",GAKUSHOKU_LOG_WEBHOOK_URL); //Discordにログを残す
          
      }else{
        postDiscord(eventData.message.text,"ログ",GAKUSHOKU_LOG_WEBHOOK_URL);


      }
    }
  }
}

function After3pmOffset() {
  const now = new Date(); // 現在時刻を取得する
  const hour = now.getHours(); // 現在の時間を取得する

  if (hour >= 15) {
    return 1;
  } else {
    return 0;
  }
}

