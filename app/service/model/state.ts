export type FindStatResponse = {
  cpu: Stat[];
  disk: Disk[];
  mem: Stat[];
  net: NetStat[];
  [property: string]: any;
};

export type Disk = {
  name: string;
  total: number;
  used: number;
  [property: string]: any;
};

export type Stat = {
  time: string;
  use: number;
  [property: string]: any;
};

export type NetStat = {
  time: string;
  up: number;
  down: number;
  [property: string]: any;
};
