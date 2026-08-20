import { gql } from 'apollo-angular';

const TASK_FIELDS = `
  id
  title
  description
  status
  priority
  dueDate
  completedAt
  createdAt
  updatedAt
  seriesId
  occurrenceDate
  progress {
    completed
    total
    percentage
  }
  recurrence {
    id
    seriesId
    frequency
    interval
    daysOfWeek
    dayOfMonth
    startDate
    endDate
    timezone
    isActive
  }
  category {
    id
    name
    icon
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      avatarUrl
      ianaTimezone
      createdAt
      updatedAt
      lastLoginAt
    }
  }
`;

export const UPDATE_MY_TIMEZONE_MUTATION = gql`
  mutation UpdateMyTimezone($timezone: String!) {
    updateMyTimezone(timezone: $timezone) {
      id
      ianaTimezone
    }
  }
`;

export const DASHBOARD_SUMMARY_QUERY = gql`
  query DashboardSummary {
    dashboardSummary {
      todayTotal
      todayCompleted
      todayOpen
      todayInProgress
      todayPending
      todayHighPriority
      overdueCount
      upcomingCount
      completedTodayCount
      totalActiveTasks
      completionPercentage
    }
  }
`;

export const TASKS_QUERY = gql`
  query Tasks($filter: TaskFilterInput) {
    tasks(filter: $filter) {
      items {
        ${TASK_FIELDS}
      }
      pageInfo {
        total
        page
        limit
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const TASK_QUERY = gql`
  query Task($id: ID!) {
    task(id: $id) {
      ${TASK_FIELDS}
    }
  }
`;

export const CATEGORIES_QUERY = gql`
  query Categories {
    categories {
      id
      name
      description
      icon
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_TASK_MUTATION = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      ${TASK_FIELDS}
    }
  }
`;

export const COMPLETE_TASK_MUTATION = gql`
  mutation CompleteTask($id: ID!) {
    completeTask(id: $id) {
      ${TASK_FIELDS}
    }
  }
`;

export const REOPEN_TASK_MUTATION = gql`
  mutation ReopenTask($id: ID!) {
    reopenTask(id: $id) {
      ${TASK_FIELDS}
    }
  }
`;

export const ARCHIVE_TASK_MUTATION = gql`
  mutation ArchiveTask($id: ID!) {
    archiveTask(id: $id) {
      id
      status
    }
  }
`;

export const RESTORE_TASK_MUTATION = gql`
  mutation RestoreTask($id: ID!) {
    restoreTask(id: $id) {
      ${TASK_FIELDS}
    }
  }
`;

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

export const STOP_RECURRENCE_MUTATION = gql`
  mutation StopRecurrence($taskId: ID!) {
    stopRecurrence(taskId: $taskId) {
      ${TASK_FIELDS}
    }
  }
`;

export const SUBTASKS_QUERY = gql`
  query Subtasks($taskId: ID!) {
    subtasks(taskId: $taskId) {
      id
      taskId
      title
      description
      status
      position
      completedAt
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_SUBTASK_MUTATION = gql`
  mutation CreateSubtask($input: CreateSubtaskInput!) {
    createSubtask(input: $input) {
      id
      taskId
      title
      status
      position
      completedAt
    }
  }
`;

export const UPDATE_SUBTASK_MUTATION = gql`
  mutation UpdateSubtask($id: ID!, $input: UpdateSubtaskInput!) {
    updateSubtask(id: $id, input: $input) {
      id
      title
      status
      position
    }
  }
`;

export const COMPLETE_SUBTASK_MUTATION = gql`
  mutation CompleteSubtask($id: ID!) {
    completeSubtask(id: $id) {
      id
      status
      completedAt
    }
  }
`;

export const REOPEN_SUBTASK_MUTATION = gql`
  mutation ReopenSubtask($id: ID!) {
    reopenSubtask(id: $id) {
      id
      status
      completedAt
    }
  }
`;

export const DELETE_SUBTASK_MUTATION = gql`
  mutation DeleteSubtask($id: ID!) {
    deleteSubtask(id: $id)
  }
`;

export const REMINDERS_QUERY = gql`
  query Reminders($taskId: ID!) {
    reminders(taskId: $taskId) {
      id
      taskId
      fireAt
      offsetMinutes
      channel
      sentAt
      createdAt
    }
  }
`;

export const CREATE_REMINDER_MUTATION = gql`
  mutation CreateReminder($input: CreateReminderInput!) {
    createReminder(input: $input) {
      id
      taskId
      fireAt
      offsetMinutes
      channel
    }
  }
`;

export const UPDATE_REMINDER_MUTATION = gql`
  mutation UpdateReminder($id: ID!, $input: UpdateReminderInput!) {
    updateReminder(id: $id, input: $input) {
      id
      fireAt
      offsetMinutes
      channel
    }
  }
`;

export const DELETE_REMINDER_MUTATION = gql`
  mutation DeleteReminder($id: ID!) {
    deleteReminder(id: $id)
  }
`;

export const NOTIFICATIONS_QUERY = gql`
  query Notifications($filter: NotificationsInput) {
    notifications(filter: $filter) {
      items {
        id
        taskId
        type
        channel
        status
        title
        message
        scheduledAt
        deliveredAt
        readAt
        createdAt
        updatedAt
      }
      pageInfo {
        total
        page
        limit
        totalPages
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const UNREAD_NOTIFICATION_COUNT_QUERY = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const NOTIFICATION_PREFERENCES_QUERY = gql`
  query NotificationPreferences {
    notificationPreferences {
      id
      inAppEnabled
      emailEnabled
      pushEnabled
      reminderEnabled
      pushAvailable
      emailAvailable
      pushPublicKey
      createdAt
      updatedAt
    }
  }
`;

export const PUSH_SUBSCRIPTIONS_QUERY = gql`
  query PushSubscriptions {
    pushSubscriptions {
      id
      endpoint
      p256dh
      auth
      createdAt
      updatedAt
    }
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;

export const UPDATE_NOTIFICATION_PREFERENCES_MUTATION = gql`
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) {
    updateNotificationPreferences(input: $input) {
      id
      inAppEnabled
      emailEnabled
      pushEnabled
      reminderEnabled
      pushAvailable
      emailAvailable
      pushPublicKey
      createdAt
      updatedAt
    }
  }
`;

export const SAVE_PUSH_SUBSCRIPTION_MUTATION = gql`
  mutation SavePushSubscription($input: SavePushSubscriptionInput!) {
    savePushSubscription(input: $input) {
      id
      endpoint
      p256dh
      auth
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_PUSH_SUBSCRIPTION_MUTATION = gql`
  mutation RemovePushSubscription($input: RemovePushSubscriptionInput!) {
    removePushSubscription(input: $input)
  }
`;

export const CREATE_CATEGORY_MUTATION = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      description
      icon
    }
  }
`;

export const UPDATE_CATEGORY_MUTATION = gql`
  mutation UpdateCategory($id: ID!, $input: UpdateCategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      name
      description
      icon
    }
  }
`;

export const DELETE_CATEGORY_MUTATION = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const AI_USAGE_QUERY = gql`
  query AiUsage {
    aiUsage {
      dailyLimit
      used
      remaining
      resetAt
      providerConfigured
    }
  }
`;

export const AI_CONVERSATIONS_QUERY = gql`
  query AiConversations {
    aiConversations {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const AI_MESSAGES_QUERY = gql`
  query AiMessages($conversationId: ID!, $limit: Int) {
    aiMessages(conversationId: $conversationId, limit: $limit) {
      items {
        id
        role
        content
        toolName
        toolCallId
        toolStatus
        createdAt
      }
      limit
    }
  }
`;

export const CREATE_AI_CONVERSATION_MUTATION = gql`
  mutation CreateAiConversation {
    createAiConversation {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const AI_CHAT_MUTATION = gql`
  mutation AiChat($input: AiChatInput!) {
    aiChat(input: $input) {
      conversation {
        id
        title
        createdAt
        updatedAt
      }
      assistantMessage {
        id
        role
        content
        createdAt
      }
      toolCalls {
        toolName
        toolCallId
        summary
        success
      }
      pendingConfirmation {
        id
        action
        title
        description
        toolName
      }
      completed
      usage {
        dailyLimit
        used
        remaining
        resetAt
        providerConfigured
      }
    }
  }
`;

export const CONFIRM_AI_ACTION_MUTATION = gql`
  mutation ConfirmAiAction($input: ConfirmAiActionInput!) {
    confirmAiAction(input: $input) {
      conversation {
        id
        title
        updatedAt
      }
      assistantMessage {
        id
        role
        content
        createdAt
      }
      toolResult {
        toolName
        summary
        success
      }
      completed
    }
  }
`;

export const DELETE_AI_CONVERSATION_MUTATION = gql`
  mutation DeleteAiConversation($id: ID!) {
    deleteAiConversation(id: $id)
  }
`;

export const CLEAR_AI_CONVERSATION_MUTATION = gql`
  mutation ClearAiConversation($id: ID!) {
    clearAiConversation(id: $id) {
      id
      title
      updatedAt
    }
  }
`;

export const AI_CONVERSATION_ATTACHMENTS_QUERY = gql`
  query AiConversationAttachments($conversationId: ID!) {
    aiConversationAttachments(conversationId: $conversationId) {
      id
      originalFilename
      mimeType
      sizeBytes
      status
      createdAt
      updatedAt
    }
  }
`;

export const UPLOAD_AI_ATTACHMENT_MUTATION = gql`
  mutation UploadAiAttachment($input: UploadAiAttachmentInput!) {
    uploadAiAttachment(input: $input) {
      id
      originalFilename
      mimeType
      sizeBytes
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_AI_ATTACHMENT_MUTATION = gql`
  mutation DeleteAiAttachment($input: DeleteAiAttachmentInput!) {
    deleteAiAttachment(input: $input)
  }
`;

// ── Calendar operations ─────────────────────────────────────────────────────

export const CALENDAR_CONNECTION_QUERY = gql`
  query CalendarConnection {
    calendarConnection {
      connected
      providerAccountId
      connectedAt
      lastSyncedAt
    }
  }
`;

export const CALENDAR_AUTH_URL_QUERY = gql`
  query CalendarAuthUrl {
    calendarAuthUrl
  }
`;

export const CALENDAR_EVENTS_QUERY = gql`
  query CalendarEvents($input: CalendarEventsInput!) {
    calendarEvents(input: $input) {
      id
      title
      description
      startAt
      endAt
      isAllDay
      timezone
      location
      status
    }
  }
`;

export const TODAY_CALENDAR_EVENTS_QUERY = gql`
  query TodayCalendarEvents {
    todayCalendarEvents {
      id
      title
      startAt
      endAt
      isAllDay
      status
      location
    }
  }
`;

export const CONNECT_CALENDAR_MUTATION = gql`
  mutation ConnectCalendar($input: ConnectCalendarInput!) {
    connectCalendar(input: $input)
  }
`;

export const DISCONNECT_CALENDAR_MUTATION = gql`
  mutation DisconnectCalendar {
    disconnectCalendar
  }
`;

export const SYNC_CALENDAR_MUTATION = gql`
  mutation SyncCalendar {
    syncCalendar {
      success
      eventsUpserted
      message
    }
  }
`;
