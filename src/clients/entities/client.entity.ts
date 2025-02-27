import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Certificate } from '../../certificates/entities/certificate.entity';
import { Document } from '../../documents/entities/document.entity';
import { Exclude } from 'class-transformer';

@Entity()
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  cpf: string;

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ default: false })
  hasCertificate: boolean;

  @Column({ default: false })
  isCertificateValid: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  documentPhotoUrl: string;

  @Column({ nullable: true })
  facialPhotoUrl: string;

  @OneToMany(() => Certificate, (certificate) => certificate.client)
  certificates: Certificate[];

  @OneToMany(() => Document, (document) => document.client)
  documents: Document[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
