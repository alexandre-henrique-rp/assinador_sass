import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subject: string;

  @Column()
  serialNumber: string;

  @Column()
  publicKey: string;

  @Column()
  @Exclude()
  privateKey: string;

  @Column()
  issuedAt: Date;

  @Column()
  validUntil: Date;

  @Column({ default: true })
  isValid: boolean;

  @Column()
  issuer: string;

  @Column({ type: 'text' })
  certificatePem: string;

  @ManyToOne(() => Client, client => client.certificates)
  client: Client;

  @Column({ nullable: true })
  clientId: string;

  @Column({ default: false })
  isCA: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
