export type LinkRole = 'hub' | 'authority' | 'power' | 'balanced' | 'peripheral';

export interface HITSRow {
    authority_score: number;
    hub_score: number;
    link_role: LinkRole;
}

export interface HITSOptions {
    iterations?: number;
}
