import {
  createTeam,
  mapRowToTeam,
  mapTeamToRow,
  type Team,
  type TeamRow,
} from '../domain/team.ts'

export interface SqlExecutor {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>
  execute(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ affectedRows: number }>
}

export interface TeamRepository {
  findAll(filter?: { managerId?: string }): Promise<Team[]>
  findByManagerId(managerId: string): Promise<Team | null>
  create(team: Team): Promise<Team>
  update(managerId: string, update: { name: string }): Promise<Team | null>
  delete(managerId: string): Promise<boolean>
}

export const SYNTHETIC_SEED_TEAMS: readonly Team[] = [
  {
    managerId: 'emp-katalin',
    name: 'Fejlesztési csapat',
  },
  {
    managerId: 'emp-piri',
    name: 'HR és Operáció',
  },
  {
    managerId: 'emp-gabor',
    name: 'Termékfejlesztés',
  },
]

export class InMemoryTeamRepository implements TeamRepository {
  private readonly store = new Map<string, TeamRow>()

  constructor(initialTeams: readonly Team[] = SYNTHETIC_SEED_TEAMS) {
    for (const team of initialTeams) {
      const row = mapTeamToRow(team)
      this.store.set(row.manager_id, row)
    }
  }

  async findAll(filter?: { managerId?: string }): Promise<Team[]> {
    const rows = Array.from(this.store.values())
    const filtered = filter?.managerId
      ? rows.filter((row) =>
          row.manager_id.toLowerCase().includes(filter.managerId!.toLowerCase()),
        )
      : rows
    return filtered.map(mapRowToTeam)
  }

  async findByManagerId(managerId: string): Promise<Team | null> {
    const row = this.store.get(managerId)
    return row ? mapRowToTeam(row) : null
  }

  async create(team: Team): Promise<Team> {
    const validated = createTeam(team)
    if (this.store.has(validated.managerId)) {
      throw new DuplicateTeamError(validated.managerId)
    }
    const row = mapTeamToRow(validated)
    this.store.set(row.manager_id, row)
    return mapRowToTeam(row)
  }

  async update(
    managerId: string,
    update: { name: string },
  ): Promise<Team | null> {
    if (!this.store.has(managerId)) {
      return null
    }
    const validated = createTeam({
      managerId,
      name: update.name,
    })
    const row = mapTeamToRow(validated)
    this.store.set(managerId, row)
    return mapRowToTeam(row)
  }

  async delete(managerId: string): Promise<boolean> {
    return this.store.delete(managerId)
  }
}

export class MariaDbTeamRepository implements TeamRepository {
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findAll(filter?: { managerId?: string }): Promise<Team[]> {
    if (filter?.managerId) {
      const rows = await this.db.query<TeamRow>(
        'SELECT manager_id, name FROM teams WHERE manager_id = ? ORDER BY name ASC',
        [filter.managerId],
      )
      return rows.map(mapRowToTeam)
    }

    const rows = await this.db.query<TeamRow>(
      'SELECT manager_id, name FROM teams ORDER BY name ASC',
    )
    return rows.map(mapRowToTeam)
  }

  async findByManagerId(managerId: string): Promise<Team | null> {
    const rows = await this.db.query<TeamRow>(
      'SELECT manager_id, name FROM teams WHERE manager_id = ? LIMIT 1',
      [managerId],
    )
    return rows[0] ? mapRowToTeam(rows[0]) : null
  }

  async create(team: Team): Promise<Team> {
    const validated = createTeam(team)
    const existing = await this.findByManagerId(validated.managerId)
    if (existing) {
      throw new DuplicateTeamError(validated.managerId)
    }

    const row = mapTeamToRow(validated)
    await this.db.execute(
      'INSERT INTO teams (manager_id, name) VALUES (?, ?)',
      [row.manager_id, row.name],
    )
    return validated
  }

  async update(
    managerId: string,
    update: { name: string },
  ): Promise<Team | null> {
    const validated = createTeam({
      managerId,
      name: update.name,
    })
    const row = mapTeamToRow(validated)
    const result = await this.db.execute(
      'UPDATE teams SET name = ? WHERE manager_id = ?',
      [row.name, row.manager_id],
    )
    if (result.affectedRows === 0) {
      return null
    }
    return validated
  }

  async delete(managerId: string): Promise<boolean> {
    const result = await this.db.execute(
      'DELETE FROM teams WHERE manager_id = ?',
      [managerId],
    )
    return result.affectedRows > 0
  }
}

export class DuplicateTeamError extends Error {
  readonly managerId: string

  constructor(managerId: string) {
    super(`Ehhez a vezetőhöz ('${managerId}') már tartozik csapat.`)
    this.name = 'DuplicateTeamError'
    this.managerId = managerId
  }
}
