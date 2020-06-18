import { App } from "@slack/bolt";
import Keyv from "keyv";
import genTrip from "2ch-trip";
import crypto from "crypto";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const keyv = new Keyv(process.env.REDISTOGO_URL, {
  namespace: process.env.NODE_ENV === "development" ? "dev" : "prod",
});

const genId = (userId: string) => {
  const d = new Date();

  const hu = crypto
    .createHmac("sha256", process.env.SECRET || "secret")
    .update(userId)
    .digest("hex");

  return crypto
    .createHash("md5")
    .update(`${hu}//${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    .digest("base64")
    .substr(0, 9);
};

const formatName = (name: string) => {
  return name.replace("◆", "◇").replace(/#(.*?)$/, genTrip);
};

app.shortcut("post", async ({ shortcut, ack, context }) => {
  ack();

  try {
    const result = await app.client.views.open({
      token: context.botToken,
      trigger_id: shortcut.trigger_id,
      view: {
        type: "modal",
        callback_id: "modal-post",
        title: {
          type: "plain_text",
          text: "投稿",
        },
        close: {
          type: "plain_text",
          text: "閉じる",
        },
        blocks: [
          {
            type: "input",
            block_id: "name",
            optional: true,
            label: {
              type: "plain_text",
              text: "名前",
            },
            element: {
              type: "plain_text_input",
              action_id: "data",
            },
          },
          {
            type: "input",
            block_id: "body",
            label: {
              type: "plain_text",
              text: "本文",
            },
            element: {
              type: "plain_text_input",
              action_id: "data",
              multiline: true,
            },
          },
        ],
        submit: {
          type: "plain_text",
          text: "書き込む",
        },
      },
    });

    console.info(result.ok);
  } catch (e) {
    console.error(e);
  }
});

app.view("modal-post", async ({ ack, body, view, context }) => {
  await ack();
  // console.log(view.state.values);
  const n = (await keyv.get("post_num")) || 1;

  const values = view.state.values;
  const name =
    values.name?.data?.value || process.env.DEFAULT_USERNAME || "名無しさん";

  const id = genId(body.user.id);
  const username = `${n} 名前：${
    name === "fusianasan" ? body.user.id : formatName(name)
  } ID:${id}`;

  try {
    await app.client.chat.postMessage({
      token: context.botToken,
      channel: process.env.SLACK_CHANNEL || "USLACKBOT",
      text: values.body.data.value,
      username,
    });

    await keyv.set("post_num", n + 1);
  } catch (e) {
    console.error(e);
  }
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log("⚡️ Bolt app is running!");
})();
