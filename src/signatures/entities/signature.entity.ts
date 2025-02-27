import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

export enum SignatureType {
  ADVANCED = 'Avançada',
  ICP_BRASIL = 'ICP-Brasil',
}

@Entity()
export class Signature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client)
  signer: Client;

  @Column()
  signerId: string;

  @Column()
  signerCpf: string;

  @CreateDateColumn()
  signedAt: Date;

  @Column({
    type: 'varchar',
    default: SignatureType.ADVANCED,
  })
  type: string;

  @Column({ nullable: true })
  certificateId: string;

  @Column()
  documentId: string;

  @Column({ nullable: true })
  signatureData: string;
}
