import {
  ApplicationCommandOptionType,
  ChannelType,
  Client,
  CommandInteraction,
  CommandInteractionOptionResolver,
  PermissionFlagsBits,
} from 'discord.js'
import GuildConfiguration from '../../models/GuildConfiguration'
import Suggestion from '../../models/Suggestion'

export default {
  name: 'config-suggestions',
  description: 'Nastav konfiguraci serveru pro návrhy',
  dm_permissions: false,
  options: [
    {
      name: 'add',
      description: 'Přídání kanálu pro návrhy',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'Kanál pro návrhy',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'remove',
      description: 'Odebrání kanálu pro návrhy',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'Kanál pro návrhy',
          type: ApplicationCommandOptionType.Channel,
          channel_types: [ChannelType.GuildText],
          required: true,
        },
      ],
    },
    {
      name: 'channels',
      description: 'Zobrazí kanály pro návrhy',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'check',
      description: 'Vypíše, kdo jak hlasoval pro daný návrh',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'id',
          description: 'ID návrhu',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  permissionsRequired: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],

  callback: async (client: Client, interaction: CommandInteraction) => {
    let guildConfiguration = await GuildConfiguration.findOne({
      guildId: interaction.guildId,
    })

    if (!guildConfiguration) {
      guildConfiguration = new GuildConfiguration({
        guildId: interaction.guildId,
      })
    }

    const options = interaction.options as CommandInteractionOptionResolver

    const subcommand = options.getSubcommand()

    if (subcommand === 'add') {
      const channel = options.getChannel('channel')

      if (!channel) {
        return interaction.reply({
          content: 'Něco se pokazilo',
        })
      }

      if (guildConfiguration.suggestionChannelIds.includes(channel.id)) {
        return await interaction.reply(
          `Kanál ${channel} už je nastavený pro návrhy`
        )
      }

      guildConfiguration.suggestionChannelIds.push(channel.id)
      await guildConfiguration.save()

      return await interaction.reply(
        `Kanál ${channel} byl úspěšně přidán pro návrhy`
      )
    }

    if (subcommand === 'remove') {
      const channel = options.getChannel('channel')

      if (!channel) {
        return interaction.reply({
          content: 'Něco se pokazilo',
        })
      }

      if (!guildConfiguration.suggestionChannelIds.includes(channel.id)) {
        return await interaction.reply(
          `Kanál ${channel} není nastavený pro návrhy`
        )
      }

      guildConfiguration.suggestionChannelIds =
        guildConfiguration.suggestionChannelIds.filter(
          (id) => id !== channel.id
        )

      await guildConfiguration.save()

      return await interaction.reply(
        `Kanál ${channel} byl úspěšně odebrán z návrhů`
      )
    }

    if (subcommand === 'channels') {
      const channels = guildConfiguration.suggestionChannelIds.map(
        (id) => `<#${id}>`
      )

      return await interaction.reply({
        content: `Kanály pro návrhy: ${channels.join(', ')}`,
      })
    }

    if (subcommand === 'check') {
      const id = options.getString('id')

      const suggestion = await Suggestion.findOne({
        messageId: id,
      })

      if (!suggestion) {
        return await interaction.reply({
          content: 'Návrh nebyl nalezen',
          ephemeral: true,
        })
      }

      const guild = interaction.guild

      if (!guild) {
        return await interaction.reply({
          content: 'Tento příkaz lze použít pouze na serveru.',
          ephemeral: true,
        })
      }

      const upvoteUsers = await Promise.all(
        suggestion.upvotes.map(async (userId) => {
          const member = await guild.members.fetch(userId)

          if (member.nickname) {
            return `${member.nickname} (${member.user.username})`
          }

          return member.user.username
        })
      )

      const downvoteUsers = await Promise.all(
        suggestion.downvotes.map(async (userId) => {
          const member = await guild.members.fetch(userId)

          if (member.nickname) {
            return `${member.nickname} (${member.user.username})`
          }

          return member.user.username
        })
      )

      return await interaction.reply({
        content: `
    Hlasování pro návrh \`${suggestion.content}\`: 
    \n👍 - ${upvoteUsers.join(', ')}
    \n👎 - ${downvoteUsers.join(', ')}
  `,
      })
    }
  },
}