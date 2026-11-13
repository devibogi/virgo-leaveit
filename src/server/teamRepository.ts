import {
  createTeam,
  mapRowToTeam,
  mapTeamToRow,
  type CreateTeamInput,
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

export interface TeamUpdate {
  name: string
  managerId: string
  deputyId: string
}

/** Teams are keyed by id; one manager may lead several teams. */
export interface TeamRepository {
  findAll(filter?: { managerId?: string }): Promise<Team[]>
  findById(id: string): Promise<Team | null>
  create(team: CreateTeamInput): Promise<Team>
  update(id: string, update: TeamUpdate): Promise<Team | null>
  delete(id: string): Promise<boolean>
}

export const SYNTHETIC_SEED_TEAMS: readonly Team[] = [
  { id: 'team-dev', managerId: 'emp-katalin', deputyId: 'emp-peter', name: 'Fejlesztési csapat' },
  { id: 'team-qa', managerId: 'emp-katalin', deputyId: 'emp-eszter', name: 'Minőségbiztosítás' },
  { id: 'team-hr', managerId: 'emp-piri', deputyId: 'emp-katalin', name: 'HR és Operáció' },
  { id: 'team-product', managerId: 'emp-gabor', deputyId: 'emp-katalin', name: 'Termékfejlesztés' },
]

export class InMemoryTeamRepository implements TeamRepository {
  private readonly store = new Map<string, TeamRow>()

  constructor(initialTeams: readonly Team[] = SYNTHETIC_SEED_TEAMS) {
    for (const team of initialTeams) {
      const row = mapTeamToRow(team)
      this.store.set(row.id, row)
    }
  }

  async findAll(filter?: { managerId?: string }): Promise<Team[]> {
    const rows = Array.from(this.store.values())
    const filtered = filter?.managerId
      ? rows.filter((row) => row.manager_id === filter.managerId)
      : rows
    return filtered.map(mapRowToTeam)
  }

  async findById(id: string): Promise<Team | null> {
    const row = this.store.get(id)
    return row ? mapRowToTeam(row) : null
  }

  async create(team: CreateTeamInput): Promise<Team> {
    const validated = createTeam(team)
    if (this.store.has(validated.id)) {
      throw new DuplicateTeamError(validated.id)
    }
    const row = mapTeamToRow(validated)
    this.store.set(row.id, row)
    return mapRowToTeam(row)
  }

  async update(id: string, update: TeamUpdate): Promise<Team | null> {
    if (!this.store.has(id)) {
      return null
    }
    const validated = createTeam({ id, managerId: update.managerId, deputyId: update.deputyId, name: update.name })
    const row = mapTeamToRow(validated)
    this.store.set(id, row)
    return mapRowToTeam(row)
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}

export class MariaDbTeamRepository implements TeamRepository {
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findAll(filter?: { managerId?: string }): Promise<Team[]> {
    const rows = filter?.managerId
      ? await this.db.query<TeamRow>(
          'SELECT id, manager_id, deputy_id, name FROM teams WHERE manager_id = ? ORDER BY name ASC',
          [filter.managerId],
        )
      : await this.db.query<TeamRow>(
          'SELECT id, manager_id, deputy_id, name FROM teams ORDER BY name ASC',
        )
    return rows.map(mapRowToTeam)
  }

  async findById(id: string): Promise<Team | null> {
    const rows = await this.db.query<TeamRow>(
      'SELECT id, manager_id, deputy_id, name FROM teams WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? mapRowToTeam(rows[0]) : null
  }

  async create(team: CreateTeamInput): Promise<Team> {
    const validated = createTeam(team)
    if (await this.findById(validated.id)) {
      throw new DuplicateTeamError(validated.id)
    }
    const row = mapTeamToRow(validated)
    await this.db.execute(
      'INSERT INTO teams (id, manager_id, deputy_id, name) VALUES (?, ?, ?, ?)',
      [row.id, row.manager_id, row.deputy_id, row.name],
    )
    return validated
  }

  async update(id: string, update: TeamUpdate): Promise<Team | null> {
    const validated = createTeam({ id, managerId: update.managerId, deputyId: update.deputyId, name: update.name })
    const row = mapTeamToRow(validated)
    const result = await this.db.execute(
      'UPDATE teams SET manager_id = ?, deputy_id = ?, name = ? WHERE id = ?',
      [row.manager_id, row.deputy_id, row.name, row.id],
    )
    if (result.affectedRows === 0) {
      return null
    }
    return validated
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM teams WHERE id = ?', [id])
    return result.affectedRows > 0
  }
}

export class DuplicateTeamError extends Error {
  readonly teamId: string

  constructor(teamId: string) {
    super(`Ilyen azonosítójú csapat ('${teamId}') már létezik.`)
    this.name = 'DuplicateTeamError'
    this.teamId = teamId
  }
}
