const {
    Client,
    Intents,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
  } = require("discord.js");
  const { google } = require("googleapis");
  const sheets = google.sheets("v4");
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  
  // Defina o ID do canal onde a embed será enviada
  const channelId = '939933336586031244'; // Substitua pelo ID do canal desejado
  
  const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
  });
  
  // Armazenar códigos gerados por usuário
  const generatedCodes = {};
  
  client.once("ready", () => {
    console.log("Bot is online!");
  });
  
  // Função para criar a embed de geração de código
  function createGenerationEmbed() {
    return new MessageEmbed()
      .setTitle("Geração de Código")
      .setDescription("Clique no botão abaixo para gerar um novo código.")
      .setColor(0x00ffff) // Azul claro
      .setFooter({ text: "Sistema de Validação" })
      .setTimestamp();
  }
  
  // Função para criar a embed de carregamento
  function createLoadingEmbed() {
    return new MessageEmbed()
      .setTitle("Gerando Código...")
      .setDescription("Por favor, aguarde enquanto geramos o seu código.")
      .setColor(0xff0000) // Vermelho para indicar que tem um processo em andamento
      .setFooter({ text: "Sistema de Validação" })
      .setTimestamp();
  }
  
  // Função para criar a embed de código gerado
  function createGeneratedEmbed(processNumber, codigo, userName) {
    return new MessageEmbed()
      .setTitle("Novo Código Gerado")
      .setColor(0x00ffff) // Azul claro para nova geração de código
      .addFields(
        { name: "Número do Processo", value: processNumber, inline: true },
        { name: "Código Gerado", value: `\`\`\`${codigo}\`\`\``, inline: true },
        { name: "Origem", value: `Discord (${userName})`, inline: true }
      )
      .setFooter({ text: "Sistema de Validação" })
      .setTimestamp();
  }
  
  client.on("messageCreate", async (message) => {
    console.log(`Received message: ${message.content}`);
    if (message.content === "!gerarCodigo") {
      console.log("Generating code...");
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("generate_code")
          .setLabel("Gerar Código")
          .setStyle("PRIMARY")
      );
  
      await message.reply({
        embeds: [createGenerationEmbed()],
        components: [row],
      });
    }
  });
  
  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton()) {
      if (interaction.customId === "generate_code") {
        // Desabilitar o botão para evitar múltiplos cliques
        const row = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId("generate_code")
            .setLabel("Gerar Código")
            .setStyle("PRIMARY")
            .setDisabled(true) // Desabilita o botão
        );
  
        // Atualiza a mensagem para indicar que o código está sendo gerado
        await interaction.update({
          embeds: [createLoadingEmbed()],
          components: [row],
        });
  
        const authClient = await auth.getClient();
        const sheet = sheets.spreadsheets.values;
        const spreadsheetId = "10pbVrNAEIhSDLsWfkRUodtdM8dlcwVWSJUHxGFnoBxo";
        const sheetName = "Banco de códigos";
  
        // Obtenha os dados da planilha
        const res = await sheet.get({
          auth: authClient,
          spreadsheetId,
          range: `${sheetName}!B:B`,
        });
  
        const existingCodes = res.data.values.flat().filter((code) => code);
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = ("0" + (date.getMonth() + 1)).slice(-2);
        const day = ("0" + date.getDate()).slice(-2);
        const lastProcessNumber =
          existingCodes.length > 0
            ? parseInt(
                existingCodes[existingCodes.length - 1].split("-")[1].split("_")[0]
              )
            : 0;
        const processNumber = ("00" + (lastProcessNumber + 1)).slice(-3);
        let randomChars = generateRandomString(5);
        const codigo =
          "0" + year + month + day + "-" + processNumber + "_" + randomChars;
  
        // Obtenha o apelido ou nome de usuário do usuário que clicou no botão
        const user = interaction.user;
        const userName = interaction.member.nickname || user.username;
  
        // Formatar a data para o horário de Brasília
        const options = { timeZone: "America/Sao_Paulo", hour12: false };
        const formattedDate = new Intl.DateTimeFormat("pt-BR", {
          ...options,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(date).replace(",", ""); // Remove a vírgula
  
        // Adicione o novo código à planilha
        await sheet.append({
          auth: authClient,
          spreadsheetId,
          range: `${sheetName}!B:E`,
          valueInputOption: "RAW",
          resource: {
            values: [[codigo, "Não Usado", formattedDate, `Discord (${userName})`]],
          },
        });
  
        // Armazene o código gerado para o usuário
        generatedCodes[user.id] = codigo;
  
        // Envie a embed para o canal específico
        const channel = client.channels.cache.get(channelId);
        if (channel) {
          const generatedEmbed = createGeneratedEmbed(processNumber, codigo, userName);
          await channel.send({ embeds: [generatedEmbed] });
        } else {
          console.error("Canal não encontrado!");
        }
  
        // Responda ao usuário com a mensagem personalizada
        await interaction.followUp({
          content: `Código ${codigo} gerado com sucesso por <@${user.id}>! Os dados foram registrados na planilha e no canal <#${channelId}>. Aqui está o código gerado:\n\`\`\`${codigo}\`\`\``,
          ephemeral: true,
        });
  
        // Aguarde 5 segundos antes de reabilitar o botão
        setTimeout(async () => {
          const newRow = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId("generate_code")
              .setLabel("Gerar Código")
              .setStyle("PRIMARY")
              .setDisabled(false) // Habilita o botão novamente
          );
  
          // Atualiza a mensagem original para reabilitar o botão
          await interaction.message.edit({
            embeds: [createGenerationEmbed()],
            components: [newRow],
          });
        }, 5000); // Espera 5 segundos
      }
    }
  });
  
  function generateRandomString(length) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  client.login(
    "token"
  );
  