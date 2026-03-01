const { init, id } = require('@instantdb/admin')

const db = init({
  appId: process.env.INSTANT_APP_ID,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
})

async function saveToDb(userId, geminiResult) {
  const { metadata, type, ...content } = geminiResult
  const chatId = id()
  const outputId = id()

  await db.transact([
    db.tx.chats[chatId].update({
      title: metadata.title,
      sourceType: metadata.source_type,
      createdAt: Date.now(),
    }).link({ $user: userId }),

    db.tx.outputs[outputId].update({
      type,
      content,
      createdAt: Date.now(),
    }).link({ chat: chatId }),
  ])

  return { chatId, outputId }
}

async function addOutputToChat(chatId, geminiResult) {
  const { metadata, type, ...content } = geminiResult
  const outputId = id()

  await db.transact([
    db.tx.outputs[outputId].update({
      type,
      content,
      createdAt: Date.now(),
    }).link({ chat: chatId }),
  ])

  return { outputId }
}

module.exports = { saveToDb, addOutputToChat }
