export type FindStatResponse = {
  cpu: Stat[];
  disk: Disk[];
  mem: Stat[];
  net: NetStat[];
};

export type Disk = {
  name: string;
  total: number;
  used: number;
};

export type Stat = {
  time: string;
  used: number;
};

export type NetStat = {
  time: string;
  up: number;
  down: number;
};
