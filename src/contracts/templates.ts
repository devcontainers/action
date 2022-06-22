import { IOption } from './collection';

export interface Template {
    id: string;
    name: string;
    description?: string;
    categories: string[];
    options?: Record<string, IOption>;
    type: 'singleContainer' | 'dockerCompose';
    image?: {
        manifest?: string;
    };
}
