declare module 'frappe-gantt' {
  export interface GanttTask {
    id: string;
    name: string;
    start: string | Date;
    end: string | Date;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
  }

  export interface GanttOptions {
    view_mode?: 'Day' | 'Week' | 'Month' | 'Year';
    date_format?: string;
    bar_height?: number;
    column_width?: number;
    container_height?: number | 'auto';
    readonly?: boolean;
  }

  export default class Gantt {
    constructor(container: string | HTMLElement, tasks: GanttTask[], options?: GanttOptions);
    refresh(tasks: GanttTask[]): void;
    change_view_mode(viewMode: string, maintainPos?: boolean): void;
    update_options(options: GanttOptions): void;
  }
}
