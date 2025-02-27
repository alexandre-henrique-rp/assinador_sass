import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Signature } from '../../signatures/entities/signature.entity';

@Entity()
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  size: number;

  @Column()
  documentType: string;

  @Column()
  extension: string;

  @Column()
  hash: string;

  @Column()
  storagePath: string;

  @Column()
  downloadUrl: string;

  @Column()
  viewUrl: string;
  
  @Column({ default: false })
  isSigned: boolean;

  @ManyToOne(() => Client, client => client.documents)
  client: Client;

  @Column()
  clientId: string;

  @ManyToMany(() => Signature)
  @JoinTable()
  signatures: Signature[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
