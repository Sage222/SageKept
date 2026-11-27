export type UserRole = 'admin' | 'user'
export type UserTheme = 'dark' | 'light' | 'sage' | 'ocean' | 'sepia' | 'nord' | 'rose'

export interface ThemeOptionMeta {
    id: UserTheme
    name: string
    description: string
    family: 'light' | 'dark'
    bg: string
    surface: string
    accent: string
    text: string
}

export const USER_THEMES: readonly ThemeOptionMeta[] = [
    {
        id: 'light',
        name: 'Classic Light',
        description: 'Crisp white canvas with clean slate ink',
        family: 'light',
        bg: '#ffffff',
        surface: '#f1f3f4',
        accent: '#1a73e8',
        text: '#202124'
    },
    {
        id: 'dark',
        name: 'Classic Dark',
        description: 'Deep charcoal workspace with warm gold accents',
        family: 'dark',
        bg: '#202124',
        surface: '#2d2e30',
        accent: '#fbbc04',
        text: '#e8eaed'
    },
    {
        id: 'sage',
        name: 'Sage Forest',
        description: 'Botanical deep emerald with fresh mint highlights',
        family: 'dark',
        bg: '#0f1914',
        surface: '#17261e',
        accent: '#34d399',
        text: '#e4f3ec'
    },
    {
        id: 'ocean',
        name: 'Midnight Ocean',
        description: 'Abyssal navy blue with luminous sky cyan',
        family: 'dark',
        bg: '#0b1320',
        surface: '#132034',
        accent: '#38bdf8',
        text: '#e2ecf8'
    },
    {
        id: 'sepia',
        name: 'Warm Sepia',
        description: 'Cozy parchment paper with warm espresso ink',
        family: 'light',
        bg: '#f5efe4',
        surface: '#ebe1d1',
        accent: '#b45309',
        text: '#382b1e'
    },
    {
        id: 'nord',
        name: 'Nordic Frost',
        description: 'Arctic slate grey with cool glacier blue accents',
        family: 'dark',
        bg: '#242933',
        surface: '#2e3440',
        accent: '#88c0d0',
        text: '#eceff4'
    },
    {
        id: 'rose',
        name: 'Rose Dusk',
        description: 'Velvet twilight plum with soft blush rose accents',
        family: 'dark',
        bg: '#1b121c',
        surface: '#281b2a',
        accent: '#f472b6',
        text: '#f6e8f3'
    }
] as const

export const VALID_USER_THEMES: readonly UserTheme[] = USER_THEMES.map(t => t.id)

export interface UserI {
    id?: number
    username: string
    displayName: string
    role: UserRole
    theme: UserTheme
    defaultNoteColor?: string
    followSystemTheme?: boolean
    language?: string
    languagePreferencesSupported?: boolean
    avatarDataUrl: string
    avatarPreset: string
    inheritSharedLabels?: boolean
    inheritSharedBinders?: boolean
    showPastReminders?: boolean
    totpEnabled?: boolean
    hasBackupCodes?: boolean
    email?: string
    enabled?: boolean
    createdAt: string
    demoNotesCreatedAt?: string | null
}

export interface AuthSessionI {
    token: string
    id: number
    username: string
    displayName: string
    role: UserRole
    theme: UserTheme
    defaultNoteColor?: string
    followSystemTheme?: boolean
    language?: string
    languagePreferencesSupported?: boolean
    avatarDataUrl: string
    avatarPreset: string
    inheritSharedLabels?: boolean
    inheritSharedBinders?: boolean
    showPastReminders?: boolean
    totpEnabled?: boolean
    hasBackupCodes?: boolean
    demoNotesCreatedAt?: string | null
}

export interface ShareUserI {
    directShare?: boolean
    sharedViaBinder?: string
    id: number
    username: string
    displayName: string
    avatarDataUrl: string
    avatarPreset: string
    shareCount: number
    online?: boolean
}
