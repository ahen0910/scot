package Scot::Collection::Guide;
use lib '../../../lib';
use Moose 2;
extends 'Scot::Collection';
with    qw(
    Scot::Role::GetByAttr
);

=head1 Name

Scot::Collection::Guide

=head1 Description

Custom collection operations for Guides

=head1 Methods

=over 4

=item B<create_from_handler($handler_ref)>

Create an event and from a POST to the handler

=cut

override api_create => sub  {
    my $self    = shift;
    my $request = shift;
    my $env     = $self->env;
    my $log     = $env->log;

    $log->trace("Custom create in Scot::Collection::Guide");

    my $json    = $request->{request}->{json};
    my $user    = $request->{user};

    my @entries = @{$json->{entry}};
    delete $json->{entry};

    unless ( $json->{group}->{read} ) {
        $json->{group}->{read}   = $env->default_groups->{read};
    }
    unless ( $json->{group}->{modify} ) {
        $json->{group}->{modify} = $env->default_groups->{modify};
    }

    my $guide   = $self->create($json);

    if ( scalar(@entries) > 0 ) {
        my $mongo   = $env->mongo;
        my $ecoll   = $mongo->collection('Entry');
        foreach my $entry ( @entries ) {
            $entry->{owner} = $entry->{owner} // $request->{user};
            $entry->{target}    = {
                type    => "guide",
                id      => $guide->id,
            };
            my $obj = $ecoll->create($entry);
        }
    }

    return $guide;
};

sub api_subthing {
    my $self        = shift;
    my $req         = shift;
    my $thing       = $req->{collection};
    my $id          = $req->{id}+0;
    my $subthing    = $req->{subthing};
    my $mongo       = $self->env->mongo;

    if ( $subthing eq "entry" ) {
        return $mongo->collection('Entry')->get_entries_by_target({
            id      => $id,
            type    => 'guide',
        });
    }

    if ( $subthing eq "entity" )  {
        my @links   = map { $_->{entity_id} }
            $mongo->collection('Link')->get_links_by_target({
                id      => $id,
                type    => 'guide',
            })->all;
        return $mongo->collection('Entity')->find({
            id => { '$in' => \@links }
        });
    }

    if ( $subthing eq "history" ) {
        return $mongo->collection('History')->find({
            'target.id'   => $id,
            'target.type' => 'guide'
        });
    }

    if ( $subthing eq "file" ) {
        return $mongo->collection('File')->find({
            'entry_target.id'     => $id,
            'entry_target.type'   => 'guide',
        });
    }

    die "unsupported guide subthing $subthing";
}

sub autocomplete {
    my $self    = shift;
    my $frag    = shift;
    my $cursor  = $self->find({
        subject => /$frag/
    });
    my @records = map { {
        id  => $_->{id}, key => $_->{subject}
    } } $cursor->all;
    return wantarray ? @records : \@records;
}



1;
