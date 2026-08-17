import { gql } from 'apollo-angular';

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      avatarUrl
      createdAt
      updatedAt
      lastLoginAt
    }
  }
`;

export const DASHBOARD_SUMMARY_QUERY = gql`
  query DashboardSummary {
    dashboardSummary {
      todayTotal
      todayCompleted
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
        id
        title
        description
        status
        priority
        dueDate
        completedAt
        createdAt
        updatedAt
        category {
          id
          name
          icon
        }
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
      id
      title
      description
      status
      priority
      dueDate
      category {
        id
        name
        icon
      }
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      description
      status
      priority
      dueDate
      category {
        id
        name
        icon
      }
    }
  }
`;

export const COMPLETE_TASK_MUTATION = gql`
  mutation CompleteTask($id: ID!) {
    completeTask(id: $id) {
      id
      status
      completedAt
    }
  }
`;

export const REOPEN_TASK_MUTATION = gql`
  mutation ReopenTask($id: ID!) {
    reopenTask(id: $id) {
      id
      status
      completedAt
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

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
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
